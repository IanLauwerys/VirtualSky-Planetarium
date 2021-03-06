/*
	Virtual Sky
	(c) Stuart Lowe, Las Cumbres Observatory Global Telescope
	A browser planetarium using HTML5's <canvas>. It works in
	Internet Explorer using excanvas.js
	
	USAGE:
		<!--[if lt IE 9]><script src="http://lcogt.net/virtualsky/embed/excanvas.js" type="text/javascript"></script><![endif]-->
		<script src="http://lcogt.net/virtualsky/embed/jquery-1.7.1.min.js" type="text/javascript"></script>
		<script src="http://lcogt.net/virtualsky/embed/virtualsky.js" type="text/javascript"></script>
		<script type="text/javascript">
		<!--
			$(document).ready(function(){
				planetarium = $.virtualsky({id:'starmapper',projection:'polar'});	// Assumes you want to draw this to a <div> with the id 'starmapper'
			});
		// -->
		</script>
		
	OPTIONS (default values in brackets):
		id ('starmap') - The ID for the HTML element where you want the sky inserted
		projection ('polar') - The projection type as 'polar', 'stereo', 'lambert', 'equirectangular', or 'ortho'
		width (500) - Set the width of the sky unless you've set the width of the element
		height (250) - Set the height of the sky unless you've set the height of the element
		planets - either an object containing an array of planets or a JSON file
		magnitude (5) - the magnitude limit of displayed stars
		longitude (53.0) - the longitude of the observer
		latitude (-2.5) - the latitude of the observer
		clock (now) - a Javascript Date() object with the starting date/time
		background ('rgba(0,0,0,0)') - the background colour
		transparent (false) - make the sky background transparent
		color ('rgb(255,255,255)') - the text colour
		az (180) - an azimuthal offset with 0 = north and 90 = east
		negative (false) - invert the default colours i.e. to black on white
		gradient (true) - reduce the brightness of stars near the horizon
		cardinalpoints (true) - show/hide the N/E/S/W labels
		constellations (false) - show/hide the constellation lines
		constellationlabels (false) - show/hide the constellation labels
		constellationboundaries (false) - show/hide the constellation boundaries (IAU)
		showstars (true) - show/hide the stars
		showstarlabels (false) - show/hide the star labels for brightest stars
		showplanets (true) - show/hide the planets
		showorbits (false) - show/hide the orbits of the planets
		showdate (true) - show/hide the date and time
		showposition (true) - show/hide the latitude/longitude
		ground (false) - show/hide the local ground (for full sky projections)
		keyboard (true) - allow keyboard controls
		mouse (true) - allow mouse controls
		gridlines_az (false) - show/hide the azimuth/elevation grid lines
		gridlines_eq (false) - show/hide the RA/Dec grid lines
		gridstep (30) - the size of the grid step when showing grid lines
		live (false) - update the display in real time
*/
(function ($) {

/*@cc_on
// Fix for IE's inability to handle arguments to setTimeout/setInterval
// From http://webreflection.blogspot.com/2007/06/simple-settimeout-setinterval-extra.html
(function(f){
	window.setTimeout =f(window.setTimeout);
	window.setInterval =f(window.setInterval);
})(function(f){return function(c,t){var a=[].slice.call(arguments,2);return f(function(){c.apply(this,a)},t)}});
@*/
// Define a shortcut for checking variable types
function is(a,b){ return (typeof a == b) ? true : false; }

$.extend($.fn.addTouch = function(){
	// Adapted from http://code.google.com/p/rsslounge/source/browse/trunk/public/javascript/addtouch.js?spec=svn115&r=115
	this.each(function(i,el){
		// Pass the original event object because the jQuery event object
		// is normalized to w3c specs and does not provide the TouchList.
		$(el).bind('touchstart touchmove touchend touchcancel touchdbltap',function(){ handleTouch(event); });
	});
	var handleTouch = function(event){
		event.preventDefault();

		var simulatedEvent;
		var touches = event.changedTouches,
		first = touches[0],
		type = '';
		switch(event.type){
			case 'touchstart':
				type = ['mousedown','click'];
				break;
			case 'touchmove':
				type = ['mousemove'];
				break;        
			case 'touchend':
				type = ['mouseup'];
				break;
			case 'touchdbltap':
				type = ['dblclick'];
				break;
			default:
				return;
		}
		for(var i = 0; i < type.length; i++){
			simulatedEvent = document.createEvent('MouseEvent');
			simulatedEvent.initMouseEvent(type[i], true, true, window, 1, first.screenX, first.screenY, first.clientX, first.clientY, false, false, false, false, 0/*left*/, null);
			first.target.dispatchEvent(simulatedEvent);
		}
	};
});


function VirtualSky(input){

	this.version = "0.3.14";

	this.ie = false;
	this.excanvas = (typeof G_vmlCanvasManager != 'undefined') ? true : false;
	/*@cc_on
	this.ie = true
	@*/

	this.id = '';						// The ID of the canvas/div tag - if none given it won't display
	this.gradient = true;				// Show the sky gradient
	this.magnitude = 5;					// Limit for stellar magnitude
	this.background = "rgba(0,0,0,0)";	// Default background colour is transparent
	this.color = "";					// Default background colour is chosen automatically
	this.wide = 0;						// Default width if not set in the <canvas> <div> or input argument
	this.tall = 0;

	// Set location on the Earth
	this.longitude = -119.86286;
	this.latitude = 34.4326;

	// Toggles
	this.spin = false;
	this.cardinalpoints = true;			// Display N, E, S and W.
	this.constellations = false;		// Draw the constellation lines
	this.constellationboundaries = false;// Draw the constellation boundaries
	this.constellationlabels = false;	// Display the constellation name labels
	this.meteorshowers = false;			// Display meteor shower radiants
	this.negative = false;				// Invert colours to make it better for printing
	this.showstars = true;				// Display current positions of the stars
	this.showstarlabels = false;		// Display names for named stars
	this.showplanets = true;			// Display current positions of the planets
	this.showplanetlabels = true;		// Display names for planets
	this.showorbits = false;			// Display the orbital paths of the planets
	this.showdate = true;				// Display the current date
	this.showposition = true;			// Display the longitude/latitude
	this.ground = false;
	this.gridlines_az = false;
	this.gridlines_eq = false;
	this.gridstep = 30;
	this.keyboard = true;				// Allow keyboard controls
	this.mouse = true;					// Allow mouse controls
	this.islive = false;				// Update the sky in real time
	this.fullscreen = false;			// Should it take up the full browser window
	this.transparent = false;			// Show the sky background or not
	this.credit = (location.host == "lcogt.net" && location.href.indexOf("/embed") < 0) ? false : true;
	this.callback = {geo:'',mouseenter:'',mouseout:''};

	// Constants
	this.d2r = Math.PI/180;
	this.r2d = 180.0/Math.PI;

	// Projections
	this.projections = {
		'polar': {
			azel2xy: function(az,el,w,h,vs){
				var radius = h/2;
				var r = radius*(90-el)/90;
				y = radius-r*Math.cos(az*vs.d2r);
				x = w/2-r*Math.sin(az*vs.d2r);
				return {x:x,y:y};
			},
			polartype: true
		},
		'stereo': {
			azel2xy: function(az,el,w,h,vs){
				var sinel1 = Math.sin(0);
				var cosel1 = Math.cos(0);
				var cosaz = Math.cos((az-180)*vs.d2r);
				var sinaz = Math.sin((az-180)*vs.d2r);
				var sinel = Math.sin(el*vs.d2r);
				var cosel = Math.cos(el*vs.d2r);
				var k = 2/(1+sinel1*sinel+cosel1*cosel*cosaz);
				x = w/2+0.42*k*h*cosel*sinaz;
				y = h-0.42*k*h*(cosel1*sinel-sinel1*cosel*cosaz);
				return {x:x,y:y};
			}
		},
		'lambert':{
			azel2xy: function(az,el,w,h,vs){
				var cosaz = Math.cos((az-180)*vs.d2r);
				var sinaz = Math.sin((az-180)*vs.d2r);
				var sinel = Math.sin(el*vs.d2r);
				var cosel = Math.cos(el*vs.d2r);
				var k = Math.sqrt(2/(1+cosel*cosaz));
				x = w/2+0.6*h*k*cosel*sinaz;
				y = h-0.6*h*k*(sinel);
				return {x:x,y:y};
			}
		},
		'ortho':{
			azel2xy: function(az,el,w,h,vs){
				var radius = h/2;
				var r = radius*Math.cos(el*vs.d2r);
				y = radius-r*Math.cos(az*vs.d2r);
				x = w/2-r*Math.sin(az*vs.d2r);
				return {x:x,y:y};
			},
			polartype:true
		},
		'fisheye':{
			azel2xy: function(az,el,w,h,vs){
				var radius = h/2;
				// R = 2 * f * sin(theta/2)
				var r = radius*Math.sin((90-el)*vs.d2r/2)/0.70710678;	// the field of view is bigger than 180 degrees
				//var r = radius*(90-el)/95;	// the field of view is bigger than 180 degrees
				y = radius-r*Math.cos(az*vs.d2r);
				x = w/2-r*Math.sin(az*vs.d2r);
				return {x:x,y:y};
			},
			polartype:true
		},
		'equirectangular':{
			azel2xy: function(az,el,w,h){
				x = ((az-180)/90)*h + w/2;
				y = h-(el/90)*h;
				return {x:x,y:y};
			},
			maxb: 90
		},
		'mollweide':{
			azel2xy: function(az,el,w,h){
				return {x:0,y:0};
			},
			radec2xy: function(ra,dec){
				var dtheta, x, y, coords, sign, outside, normra;
				var thetap = Math.abs(dec)*this.d2r;
				var pisindec = Math.PI*Math.sin(Math.abs(dec)*this.d2r);
				// Now iterate to correct answer
				for(var i = 0; i < 20 ; i++){
					dtheta = -(thetap + Math.sin(thetap) - pisindec)/(1+Math.cos(thetap));
					thetap += dtheta;
					if(dtheta < 1e-4) break;
				}
				normra = (ra+this.az_off)%360 - 180;
				outside = false;
				x = -(2/Math.PI)*(normra*this.d2r)*Math.cos(thetap/2)*this.tall/2 + this.wide/2;
				if(x > this.wide) outside = true;
				sign = (dec >= 0) ? 1 : -1;
				y = -sign*Math.sin(thetap/2)*this.tall/2 + this.tall/2;
				coords = this.coord2horizon(ra, dec);
				return {x:(outside ? -100 : x%this.wide),y:y,el:coords[0]};
			},
			draw: function(){
				var c = this.ctx;
				c.moveTo(this.wide/2,this.tall/2);
				c.beginPath();
				var x = this.wide/2-this.tall;
				var y = 0;
				var w = this.tall*2;
				var h = this.tall;
				var kappa = 0.5522848;
				var ox = (w / 2) * kappa; // control point offset horizontal
				var oy = (h / 2) * kappa; // control point offset vertical
				var xe = x + w;           // x-end
				var ye = y + h;           // y-end
				var xm = x + w / 2;       // x-middle
				var ym = y + h / 2;       // y-middle
				c.moveTo(x, ym);
				c.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
				c.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
				c.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
				c.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
				c.closePath();
				if(!this.transparent){
					c.fillStyle = (this.gradient && !this.negative) ? "rgba(0,15,30, 1)" : ((this.negative) ? white : black);
					c.fill();
				}
			},
			altlabeltext:true,
			fullsky:true
		},
		'planechart':{
			azel2xy: function(az,el,w,h){
				return {x:0,y:0};
			},
			radec2xy: function(ra,dec){
				var normra = (ra+this.az_off)%360-180;
				var x = -(normra/360)*this.tall*2 + this.wide/2;
				var y = -(dec/180)*this.tall+ this.tall/2;
				if(x > this.wide) outside = true;
				var coords = this.coord2horizon(ra, dec);
				return {x:(outside ? -100 : x%this.wide),y:y,el:coords[0]};
			},
			draw: function(){
				if(!this.transparent){
					this.ctx.fillStyle = (this.gradient && !this.negative) ? "rgba(0,15,30, 1)" : ((this.negative) ? white : black);
					this.ctx.fillRect((this.wide/2) - (this.tall),0,this.tall*2,this.tall);
					this.ctx.fill();
				}
			},
			fullsky:true
		}
	};
	
	// Data for stars < mag 4 or that are a vertex for a constellation line - 19 kB
	this.stars = [[677,2.07,2.097,29.09],[746,2.28,2.295,59.15],[765,3.88,2.353,-45.75],[1067,2.83,3.309,15.18],[1562,3.56,4.857,-8.824],[1599,4.23,5.018,-64.87],[1645,5.35,5.149,8.1903],[2021,2.82,6.438,-77.25],[2072,3.93,6.551,-43.68],[2081,2.40,6.571,-42.31],[2484,4.36,7.886,-62.96],[3092,3.27,9.832,30.86],[3179,2.24,10.13,56.54],[3419,2.04,10.9,-17.99],[3760,5.35,12.073,7.3],[3821,3.46,12.28,57.82],[3881,4.53,12.45,41.08],[4427,2.15,14.18,60.72],[4436,3.86,14.19,38.5],[4577,4.30,14.65,-29.36],[4906,4.27,15.74,7.89],[5165,3.32,16.52,-46.72],[5348,3.94,17.1,-55.25],[5364,3.46,17.15,-10.18],[5447,2.07,17.43,35.62],[5742,4.67,18.44,24.58],[6193,4.74,19.87,27.26],[6537,3.60,21.01,-8.183],[6686,2.66,21.45,60.24],[6867,3.41,22.09,-43.32],[7007,4.84,22.55,6.144],[7083,3.93,22.81,-49.07],[7097,3.62,22.87,15.35],[7588,0.45,24.43,-57.24],[7884,4.45,25.36,5.488],[8102,3.49,26.02,-15.94],[8198,4.26,26.35,9.158],[8645,3.74,27.87,-10.34],[8796,3.42,28.27,29.58],[8832,3.88,28.38,19.29],[8833,4.61,28.39,3.188],[8837,4.39,28.41,-46.3],[8886,3.35,28.6,63.67],[8903,2.64,28.66,20.81],[9007,3.69,28.99,-51.61],[9236,2.86,29.69,-61.57],[9487,3.82,30.51,2.764],[9640,2.10,30.97,42.33],[9884,2.01,31.79,23.46],[10064,3.00,32.39,34.99],[10324,4.36,33.25,8.847],[10602,3.56,34.13,-51.51],[10826,6.45,34.8366,-2.9776],[11001,4.08,35.44,-68.66],[11345,4.88,36.49,-12.29],[11407,4.24,36.75,-47.7],[11484,4.30,37.04,8.46],[11767,1.97,37.95,89.26],[11783,4.74,38.02,-15.24],[12093,4.87,38.97,5.593],[12387,4.08,39.87,0.3285],[12390,4.83,39.89,-11.87],[12394,4.12,39.9,-68.27],[12413,4.74,39.95,-42.89],[12486,4.11,40.17,-39.86],[12706,3.47,40.83,3.236],[12770,4.24,41.03,-13.86],[12828,4.27,41.24,10.11],[12843,4.47,41.28,-18.57],[13147,4.45,42.27,-32.41],[13209,3.61,42.5,27.26],[13254,4.22,42.65,38.32],[13268,3.77,42.67,55.9],[13701,3.89,44.11,-8.898],[13847,2.88,44.57,-40.3],[13954,4.71,44.93,8.907],[14135,2.54,45.57,4.09],[14146,4.08,45.6,-23.62],[14328,2.91,46.2,53.51],[14354,3.32,46.29,38.84],[14576,2.09,47.04,40.96],[14879,3.80,48.02,-28.99],[15197,4.80,48.96,-8.82],[15474,3.70,49.88,-21.76],[15510,4.26,49.98,-43.07],[15863,1.79,51.08,49.86],[15900,3.61,51.2,9.029],[16228,4.21,52.27,59.94],[16537,3.72,53.23,-9.458],[16611,4.26,53.45,-21.63],[17358,3.01,55.73,47.79],[17378,3.52,55.81,-9.763],[17440,3.84,56.05,-64.81],[17448,3.84,56.08,32.29],[17651,4.22,56.71,-23.25],[17678,3.26,56.81,-74.24],[17702,2.85,56.87,24.11],[17797,4.30,57.15,-37.62],[17847,3.62,57.29,24.05],[17874,4.17,57.36,-36.2],[17959,4.59,57.59,71.33],[18246,2.84,58.53,31.88],[18505,4.95,59.36,63.07],[18532,2.90,59.46,40.01],[18543,2.97,59.51,-13.51],[18597,4.56,59.69,-61.4],[18614,3.98,59.74,35.79],[18724,3.41,60.17,12.49],[19747,3.85,63.5,-42.29],[19780,3.33,63.61,-62.47],[19893,4.26,64.01,-51.49],[19921,4.44,64.12,-59.3],[20042,3.55,64.47,-33.8],[20205,3.65,64.95,15.63],[20455,3.77,65.73,17.54],[20535,3.97,66.01,-34.02],[20648,4.30,66.37,17.93],[20889,3.53,67.15,19.18],[20894,3.40,67.17,15.87],[21281,3.30,68.5,-55.04],[21393,3.81,68.89,-30.56],[21421,0.87,68.98,16.51],[21444,3.93,69.08,-3.352],[21594,3.86,69.55,-14.3],[21770,4.44,70.14,-41.86],[21881,4.27,70.56,22.96],[22109,4.01,71.38,-3.255],[22449,3.19,72.46,6.961],[22509,4.35,72.65,8.9],[22549,3.68,72.8,5.605],[22701,4.36,73.22,-5.453],[22730,5.3,73.345,2.508],[22783,4.26,73.51,66.34],[22845,4.64,73.72,10.15],[23015,2.69,74.25,33.17],[23123,4.47,74.64,1.714],[23416,3.03,75.49,43.82],[23453,3.69,75.62,41.08],[23685,3.19,76.37,-22.37],[23767,3.18,76.63,41.23],[23875,2.78,76.96,-5.086],[23972,4.25,77.29,-8.754],[24244,4.45,78.07,-11.87],[24305,3.29,78.23,-16.21],[24327,4.36,78.31,-12.94],[24436,0.18,78.63,-8.202],[24608,0.08,79.17,46],[24845,4.29,79.89,-13.18],[25110,5.05,80.6397,79.231],[25281,3.35,81.12,-2.397],[25336,1.64,81.28,6.35],[25428,1.65,81.57,28.61],[25606,2.81,82.06,-20.76],[25859,3.86,82.8,-35.47],[25930,2.25,83,-0.2991],[25985,2.58,83.18,-17.82],[26069,3.76,83.41,-62.49],[26207,3.39,83.78,9.934],[26241,2.75,83.86,-5.91],[26311,1.69,84.05,-1.202],[26451,2.97,84.41,21.14],[26634,2.65,84.91,-34.07],[26727,1.74,85.19,-1.943],[27072,3.59,86.12,-22.45],[27100,4.34,86.19,-65.74],[27288,3.55,86.74,-14.82],[27321,3.85,86.82,-51.07],[27366,2.07,86.94,-9.67],[27530,4.50,87.46,-56.17],[27628,3.12,87.74,-35.77],[27654,3.76,87.83,-20.88],[27890,4.65,88.53,-63.09],[27913,4.39,88.6,20.28],[27989,0.45,88.79,7.407],[28103,3.71,89.1,-14.17],[28199,4.36,89.38,-35.28],[28328,3.96,89.79,-42.82],[28360,1.90,89.88,44.95],[28380,2.65,89.93,37.21],[28614,4.12,90.6,9.647],[28734,4.16,91.03,23.26],[28910,4.67,91.54,-14.94],[29038,4.42,91.89,14.77],[29426,4.45,92.98,14.21],[29651,3.99,93.71,-6.275],[29655,3.31,93.72,22.51],[29807,4.37,94.14,-35.14],[30060,4.44,94.91,59.01],[30122,3.02,95.08,-30.06],[30277,3.85,95.53,-33.44],[30324,1.98,95.67,-17.96],[30343,2.87,95.74,22.51],[30419,4.39,95.94,4.593],[30438,-0.62,95.99,-52.7],[30867,3.76,97.2,-7.033],[30883,4.13,97.24,20.21],[31416,4.54,98.76,-22.96],[31592,3.95,99.17,-19.26],[31681,1.93,99.43,16.4],[31685,3.17,99.44,-43.2],[32246,3.06,101,25.13],[32349,-1.44,101.3,-16.72],[32362,3.35,101.3,12.9],[32607,3.24,102,-61.94],[32759,3.50,102.5,-32.51],[32768,2.94,102.5,-50.61],[33018,3.60,103.2,33.96],[33160,4.08,103.5,-12.04],[33347,4.36,104,-17.05],[33449,4.35,104.3,58.42],[33579,1.50,104.7,-28.97],[33856,3.49,105.4,-27.93],[33977,3.02,105.8,-23.83],[34045,4.11,105.9,-15.63],[34088,4.01,106,20.57],[34444,1.83,107.1,-26.39],[34481,3.78,107.2,-70.5],[34693,4.41,107.8,30.25],[34769,4.15,108,-0.4928],[35037,4.01,108.7,-26.77],[35228,3.97,109.2,-67.96],[35264,2.71,109.3,-37.1],[35350,3.58,109.5,16.54],[35550,3.50,110,21.98],[35904,2.45,111,-29.3],[36046,3.78,111.4,27.8],[36145,4.61,111.7,49.21],[36188,2.89,111.8,8.289],[36377,3.25,112.3,-43.3],[36850,1.58,113.6,31.89],[36962,4.06,114,26.9],[37279,0.40,114.8,5.225],[37447,3.94,115.3,-9.551],[37504,3.93,115.5,-72.61],[37740,3.57,116.1,24.4],[37826,1.16,116.3,28.03],[38170,3.34,117.3,-24.86],[38827,3.46,119.2,-52.98],[39429,2.21,120.9,-40],[39757,2.83,121.9,-24.3],[39794,4.35,122,-68.62],[39863,4.36,122.1,-2.984],[39953,1.75,122.4,-47.34],[40526,3.53,124.1,9.186],[40702,4.05,124.6,-76.92],[41037,1.86,125.6,-59.51],[41075,4.25,125.7,43.19],[41312,3.77,126.4,-66.14],[41704,3.35,127.6,60.72],[42313,4.14,129.4,5.704],[42402,4.45,129.7,3.341],[42515,3.97,130,-35.31],[42536,3.60,130.1,-52.92],[42568,4.31,130.2,-59.76],[42799,4.30,130.8,3.399],[42806,4.66,130.8,21.47],[42828,3.68,130.9,-33.19],[42911,3.94,131.2,18.15],[42913,1.93,131.2,-54.71],[43103,4.03,131.7,28.76],[43109,3.38,131.7,6.419],[43234,4.35,132.1,5.838],[43409,4.02,132.6,-27.71],[43813,3.11,133.8,5.946],[44066,4.26,134.6,11.86],[44127,3.12,134.8,48.04],[44248,3.96,135.2,41.78],[44382,4.00,135.6,-66.4],[44471,3.57,135.9,47.16],[44700,4.56,136.6,38.45],[44816,2.23,137,-43.43],[45080,3.43,137.7,-58.97],[45238,1.67,138.3,-69.72],[45336,3.89,138.6,2.314],[45556,2.21,139.3,-59.28],[45688,3.82,139.7,36.8],[45860,3.14,140.3,34.39],[45941,2.47,140.5,-55.01],[46390,1.99,141.9,-8.659],[46509,4.59,142.3,-2.769],[46651,3.60,142.7,-40.47],[46701,3.16,142.8,-57.03],[46733,3.65,142.9,63.06],[46776,4.54,143,-1.185],[46853,3.17,143.2,51.68],[46952,4.54,143.6,36.4],[47908,2.97,146.5,23.77],[48002,2.92,146.8,-65.07],[48319,3.78,147.7,59.04],[48356,4.11,147.9,-14.85],[48402,4.55,148,54.06],[48455,3.88,148.2,26.01],[48774,3.52,149.2,-54.57],[49583,3.48,151.8,16.76],[49593,4.49,151.9,35.24],[49641,4.48,152,-0.3716],[49669,1.36,152.1,11.97],[49841,3.61,152.6,-12.35],[50099,3.29,153.4,-70.04],[50191,3.85,153.7,-42.12],[50335,3.43,154.2,23.42],[50371,3.39,154.3,-61.33],[50372,3.45,154.3,42.91],[50583,2.01,155,19.84],[50801,3.06,155.6,41.5],[51069,3.83,156.5,-16.84],[51172,4.28,156.8,-31.07],[51232,3.81,157,-58.74],[51233,4.20,157,36.71],[51576,3.30,158,-61.69],[51839,4.11,158.9,-78.61],[51986,3.84,159.3,-48.23],[52419,2.74,160.7,-64.39],[52468,4.58,160.9,-60.57],[52727,2.69,161.7,-49.42],[52943,3.11,162.4,-16.19],[53229,3.79,163.3,34.21],[53253,3.78,163.4,-58.85],[53740,4.08,164.9,-18.3],[53910,2.34,165.5,56.38],[54061,1.81,165.9,61.75],[54463,3.93,167.1,-58.98],[54539,3.00,167.4,44.5],[54682,4.46,167.9,-22.83],[54872,2.56,168.5,20.52],[54879,3.33,168.6,15.43],[55219,3.49,169.6,33.09],[55282,3.56,169.8,-14.78],[55687,4.81,171.2,-10.86],[55705,4.06,171.2,-17.68],[56211,3.82,172.9,69.33],[56343,3.54,173.3,-31.86],[56480,4.62,173.7,-54.26],[56561,3.11,173.9,-63.02],[56633,4.70,174.2,-9.802],[57283,4.71,176.2,-18.35],[57363,3.63,176.4,-66.73],[57380,4.04,176.5,6.529],[57399,3.69,176.5,47.78],[57632,2.14,177.3,14.57],[57936,4.29,178.2,-33.91],[58001,2.41,178.5,53.69],[59196,2.58,182.1,-50.72],[59199,4.02,182.1,-24.73],[59316,3.02,182.5,-22.62],[59747,2.79,183.8,-58.75],[59774,3.32,183.9,57.03],[59803,2.58,184,-17.54],[60000,4.24,184.6,-79.31],[60718,0.77,186.6,-63.1],[60742,4.35,186.7,28.27],[60823,3.91,187,-50.23],[60965,2.94,187.5,-16.52],[61084,1.59,187.8,-57.11],[61174,4.30,188,-16.2],[61199,3.84,188.1,-72.13],[61281,3.85,188.4,69.79],[61317,4.24,188.4,41.36],[61359,2.65,188.6,-23.4],[61585,2.69,189.3,-69.14],[61932,2.20,190.4,-48.96],[61941,2.74,190.4,-1.449],[62322,3.04,191.6,-68.11],[62434,1.25,191.9,-59.69],[62956,1.76,193.5,55.96],[63090,3.39,193.9,3.397],[63125,2.89,194,38.32],[63608,2.85,195.5,10.96],[64166,4.94,197.3,-23.12],[64241,4.32,197.5,17.53],[64394,4.23,198,27.88],[64962,2.99,199.7,-23.17],[65109,2.75,200.1,-36.71],[65378,2.23,201,54.93],[65474,0.98,201.3,-11.16],[65936,3.90,202.8,-39.41],[66249,3.38,203.7,-0.5958],[66657,2.29,205,-53.47],[67301,1.85,206.9,49.31],[67459,4.05,207.4,15.8],[67464,3.41,207.4,-41.69],[67472,3.47,207.4,-42.47],[67927,2.68,208.7,18.4],[68002,2.55,208.9,-47.29],[68282,3.87,209.7,-44.8],[68520,4.23,210.4,1.545],[68702,0.61,211,-60.37],[68756,3.67,211.1,64.38],[68895,3.25,211.6,-26.68],[68933,2.06,211.7,-36.37],[69427,4.18,213.2,-10.27],[69673,-0.05,213.9,19.18],[69701,4.07,214,-6.001],[70576,4.33,216.5,-45.38],[70638,4.31,216.7,-83.67],[71053,3.57,218,30.37],[71075,3.04,218,38.31],[71352,2.33,218.9,-42.16],[71536,4.05,219.5,-49.43],[71681,1.35,219.9,-60.84],[71683,-0.01,219.9,-60.83],[71795,3.78,220.3,13.73],[71860,2.30,220.5,-47.39],[71908,3.18,220.6,-64.98],[71957,3.87,220.8,-5.658],[72105,2.35,221.2,27.07],[72220,3.73,221.6,1.893],[72370,3.83,222,-79.04],[72607,2.07,222.7,74.16],[72622,2.75,222.7,-16.04],[73273,2.68,224.6,-43.13],[73334,3.13,224.8,-42.1],[73555,3.49,225.5,40.39],[73714,3.25,226,-25.28],[74395,3.41,228.1,-52.1],[74666,3.46,228.9,33.31],[74785,2.61,229.3,-9.383],[74824,4.07,229.4,-58.8],[74946,2.87,229.7,-68.68],[75097,3.00,230.2,71.83],[75141,3.22,230.3,-40.65],[75177,3.57,230.5,-36.26],[75264,3.37,230.7,-44.69],[75323,4.48,230.8,-59.32],[75458,3.29,231.2,58.97],[75695,3.66,232,29.11],[76127,4.14,233.2,31.36],[76267,2.22,233.7,26.71],[76276,3.80,233.7,10.54],[76297,2.80,233.8,-41.17],[76333,3.91,233.9,-14.79],[76552,4.34,234.5,-42.57],[76952,3.81,235.7,26.3],[77055,4.29,236,77.79],[77070,2.63,236.1,6.426],[77233,3.65,236.5,15.42],[77450,4.09,237.2,18.14],[77512,4.59,237.4,26.07],[77516,3.54,237.4,-3.43],[77622,3.71,237.7,4.478],[77634,3.97,237.7,-33.63],[77760,4.60,238.2,42.45],[77853,4.13,238.5,-16.73],[77952,2.83,238.8,-63.43],[78072,3.85,239.1,15.66],[78159,4.14,239.4,26.88],[78265,2.89,239.7,-26.11],[78384,3.42,240,-38.4],[78401,2.29,240.1,-22.62],[78493,4.98,240.4,29.85],[78527,4.01,240.5,58.57],[78639,4.65,240.8,-49.23],[78820,2.56,241.4,-19.81],[78970,5.7,241.8175,-36.756],[79509,4.95,243.4,-54.63],[79593,2.73,243.6,-3.694],[79822,4.95,244.4,75.76],[79882,3.23,244.6,-4.693],[79992,3.91,244.9,46.31],[80000,4.01,245,-50.16],[80112,2.90,245.3,-25.59],[80170,3.74,245.5,19.15],[80331,2.73,246,61.51],[80582,4.46,246.8,-47.55],[80763,1.06,247.4,-26.43],[80816,2.78,247.6,21.49],[81065,3.86,248.4,-78.9],[81126,4.20,248.5,42.44],[81266,2.82,249,-28.22],[81377,2.54,249.3,-10.57],[81693,2.81,250.3,31.6],[81833,3.48,250.7,38.92],[81852,4.23,250.8,-77.52],[82080,4.21,251.5,82.04],[82273,1.91,252.2,-69.03],[82363,3.77,252.4,-59.04],[82396,2.29,252.5,-34.29],[82514,3.00,253,-38.05],[82671,4.70,253.5,-42.36],[83000,3.19,254.4,9.375],[83081,3.12,254.7,-55.99],[83207,3.92,255.1,30.93],[83895,3.17,257.2,65.71],[84012,2.43,257.6,-15.72],[84143,3.32,258,-43.24],[84345,2.78,258.7,14.39],[84379,3.12,258.8,24.84],[84380,3.16,258.8,36.81],[84606,4.64,259.4,37.29],[84880,4.32,260.2,-12.85],[84970,3.27,260.5,-25],[85112,4.15,260.9,37.15],[85258,2.84,261.3,-55.53],[85267,3.31,261.3,-56.38],[85670,2.79,262.6,52.3],[85693,4.41,262.7,26.11],[85696,2.70,262.7,-37.3],[85727,3.60,262.8,-60.68],[85755,4.78,262.9,-23.96],[85792,2.84,263,-49.88],[85822,4.35,263.1,86.59],[85829,4.86,263.1,55.17],[85927,1.62,263.4,-37.1],[86032,2.08,263.7,12.56],[86228,1.86,264.3,-43],[86263,3.54,264.4,-15.4],[86414,3.82,264.9,46.01],[86565,4.24,265.4,-12.88],[86670,2.39,265.6,-39.03],[86742,2.76,265.9,4.567],[86929,3.61,266.4,-64.72],[86974,3.42,266.6,27.72],[87072,4.53,266.9,-27.83],[87073,2.99,266.9,-40.13],[87261,3.19,267.5,-37.04],[87585,3.73,268.4,56.87],[87808,3.86,269.1,37.25],[87833,2.24,269.2,51.49],[87933,3.70,269.4,29.25],[88048,3.32,269.8,-9.774],[88635,2.98,271.5,-30.42],[88714,3.65,271.7,-50.09],[88794,3.84,271.9,28.76],[88866,4.33,272.1,-63.67],[89341,3.84,273.4,-21.06],[89642,3.10,274.4,-36.76],[89931,2.72,275.2,-29.83],[89937,3.55,275.3,72.73],[89962,3.23,275.3,-2.899],[90098,4.35,275.8,-61.49],[90185,1.79,276,-34.38],[90422,3.49,276.7,-45.97],[90496,2.82,277,-25.42],[90568,4.10,277.2,-49.07],[90595,4.67,277.3,-14.57],[91117,3.85,278.8,-8.244],[91262,0.03,279.2,38.78],[91792,4.01,280.8,-71.43],[91971,4.34,281.2,37.61],[92041,3.17,281.4,-26.99],[92175,4.22,281.8,-4.748],[92202,5.35,281.8706,-5.705],[92420,3.52,282.5,33.36],[92609,4.22,283.1,-62.19],[92791,4.22,283.6,36.9],[92814,5.05,283.6796,-15.603],[92855,2.05,283.8,-26.3],[92946,4.62,284.1,4.204],[93015,4.40,284.2,-67.23],[93085,3.52,284.4,-21.11],[93174,4.83,284.7,-37.11],[93194,3.25,284.7,32.69],[93244,4.02,284.9,15.07],[93506,2.60,285.7,-29.88],[93542,4.74,285.8,-42.1],[93683,3.76,286.2,-21.74],[93747,2.99,286.4,13.86],[93805,3.43,286.6,-4.883],[93825,4.23,286.6,-37.06],[93864,3.32,286.7,-27.67],[94005,4.57,287.1,-40.5],[94114,4.11,287.4,-37.9],[94141,2.88,287.4,-21.02],[94160,4.10,287.5,-39.34],[94376,3.07,288.1,67.66],[94779,3.80,289.3,53.37],[94820,4.88,289.4,-18.95],[95168,3.92,290.4,-17.85],[95294,4.27,290.8,-44.8],[95347,3.96,291,-40.62],[95501,3.36,291.4,3.115],[95771,4.44,292.2,24.66],[95853,3.76,292.4,51.73],[95947,3.05,292.7,27.96],[96406,5.6,294.0069,-24.719],[96757,4.39,295,18.01],[96837,4.39,295.3,17.48],[97165,2.86,296.2,45.13],[97278,2.72,296.6,10.61],[97365,3.68,296.8,18.53],[97433,3.84,297,70.27],[97649,0.76,297.7,8.868],[97804,3.87,298.1,1.006],[98032,4.12,298.8,-41.87],[98036,3.71,298.8,6.407],[98110,3.89,299.1,35.08],[98337,3.51,299.7,19.49],[98412,4.37,299.9,-35.28],[98495,3.97,300.1,-72.91],[98543,4.66,300.3,27.75],[98688,4.43,300.7,-27.71],[99240,3.55,302.2,-66.18],[99473,3.24,302.8,-0.8215],[100064,3.58,304.5,-12.54],[100345,3.05,305.3,-14.78],[100453,2.23,305.6,40.26],[100751,1.94,306.4,-56.74],[101421,4.03,308.3,11.3],[101769,3.64,309.4,14.6],[101772,3.11,309.4,-47.29],[101958,3.77,309.9,15.91],[102098,1.25,310.4,45.28],[102281,4.43,310.9,15.07],[102395,3.42,311.2,-66.2],[102422,3.41,311.3,61.84],[102485,4.13,311.5,-25.27],[102488,2.48,311.6,33.97],[102532,4.27,311.7,16.12],[102618,3.78,311.9,-9.496],[102831,4.89,312.5,-33.78],[102978,4.12,313,-26.92],[103227,3.67,313.7,-58.45],[103738,4.67,315.3,-32.26],[104139,4.08,316.5,-17.23],[104521,4.70,317.6,10.13],[104732,3.21,318.2,30.23],[104858,4.47,318.6,10.01],[104987,3.92,319,5.248],[105140,4.71,319.5,-32.17],[105199,2.45,319.6,62.59],[105319,4.39,320,-53.45],[105515,4.28,320.6,-16.83],[105570,5.15,320.723,6.811],[105858,4.21,321.6,-65.37],[105881,3.77,321.7,-22.41],[106032,3.23,322.2,70.56],[106278,2.90,322.9,-5.571],[106985,3.69,325,-16.66],[107089,3.73,325.4,-77.39],[107310,4.49,326,28.74],[107315,2.38,326,9.875],[107354,4.14,326.2,25.65],[107556,2.85,326.8,-16.13],[108085,3.00,328.5,-37.36],[109074,2.95,331.4,-0.3199],[109111,4.47,331.5,-39.54],[109139,4.29,331.6,-13.87],[109176,3.77,331.8,25.35],[109268,1.73,332.1,-46.96],[109422,4.94,332.5,-32.55],[109427,3.52,332.5,6.198],[109492,3.39,332.7,58.2],[109937,4.14,334,37.75],[110003,4.17,334.2,-7.783],[110130,2.87,334.6,-60.26],[110395,3.86,335.4,-1.387],[110538,4.42,335.9,52.23],[110609,4.55,336.1,49.48],[110960,3.65,337.2,-0.01997],[110997,3.97,337.3,-43.5],[111022,4.34,337.4,47.71],[111104,4.52,337.6,43.12],[111123,4.82,337.7,-10.68],[111169,3.76,337.8,50.28],[111188,4.29,337.9,-32.35],[111497,4.04,338.8,-0.1175],[111954,4.18,340.2,-27.04],[112029,3.41,340.4,10.83],[112122,2.07,340.7,-46.88],[112158,2.93,340.8,30.22],[112405,4.13,341.5,-81.38],[112440,3.97,341.6,23.57],[112447,4.20,341.7,12.17],[112623,3.49,342.1,-51.32],[112716,4.05,342.4,-13.59],[112724,3.50,342.4,66.2],[112748,3.51,342.5,24.6],[112961,3.73,343.2,-7.58],[113136,3.27,343.7,-15.82],[113246,4.20,344,-32.54],[113368,1.17,344.4,-29.62],[113638,4.11,345.2,-52.75],[113881,2.44,345.9,28.08],[113963,2.49,346.2,15.21],[114131,4.28,346.7,-43.52],[114341,3.68,347.4,-21.17],[114421,3.88,347.6,-45.25],[114855,4.24,349,-9.088],[114971,3.70,349.3,3.282],[114996,3.99,349.4,-58.24],[115102,4.41,349.7,-32.53],[115438,3.96,350.7,-20.1],[115738,4.95,351.7,1.256],[115830,4.27,352,6.379],[116231,4.38,353.2,-37.82],[116727,3.21,354.8,77.63],[116771,4.13,355,5.626],[116928,4.49,355.5,1.78],[118268,4.03,359.8,6.863]];

	// Data for star names to display (if showstarlabels is set to true) - an array of [Hipparcos number,Label]
	this.starnames = [[7588,"Achernar"],[11767,"Polaris"],[21421,"Aldebaran"],[24436,"Rigel"],[24608,"Capella"],[27989,"Betelgeuse"],[30438,"Canopus"],[32349,"Sirius"],[33579,"Adara"],[37279,"Procyon"],[37826,"Pollux"],[49669,"Regulus"],[62434,"Mimosa"],[65378,"Mizar"],[65474,"Spica"],[68702,"Hadar"],[69673,"Arcturus"],[71683,"Alpha Centauri A"],[80763,"Antares"],[85927,"Shaula"],[91262,"Vega"],[97649,"Altair"],[102098,"Deneb"],[113368,"Fomalhaut"]];

	// Data for faint stars - 25 kB
	this.starsdeep = "stars.json";

	// Data for constellation lines - 12 kB
	this.lines = "lines_latin.json";

	// Data for constellation boundaries - kB
	this.boundaries = "boundaries.json";

	// Load in the planet data from separate json file
	this.planets = "planets.json";

	// Load in the planet data from separate json file
	this.showers = "showers.json";

	this.hipparcos = new Array();
	this.az_step = 0;
	this.az_off = 0;
	this.clock = new Date();
	this.fullsky = false;

	// Country codes at http://en.wikipedia.org/wiki/List_of_ISO_639-1_codes
	this.language = (navigator.language) ? navigator.language : navigator.userLanguage;			// Set the user language
	this.langcode = this.language.substring(0,2);
	this.langs = new Array();
	this.langs = [{
		"code" : "en",
		"name" : "English",
		"constellations": ['Andromeda','Antlia','Apus','Aquarius','Aquila','Ara','Aries','Auriga','Bootes','Caelum','Camelopardalis','Cancer','Canes Venatici','Canis Major','Canis Minor','Capricornus','Carina','Cassiopeia','Centaurus','Cepheus','Cetus','Chamaeleon','Circinus','Columba','Coma Berenices','Corona\nAustrina','Corona Borealis','Corvus','Crater','Crux','Cygnus','Delphinus','Dorado','Draco','Equuleus','Eridanus','Fornax','Gemini','Grus','Hercules','Horologium','Hydra','Hydrus','Indus','Lacerta','Leo','Leo Minor','Lepus','Libra','Lupus','Lynx','Lyra','Mensa','Microscopium','Monoceros','Musca','Norma','Octans','Ophiuchus','Orion','Pavo','Pegasus','Perseus','Phoenix','Pictor','Pisces','Piscis Austrinus','Puppis','Pyxis','Reticulum','Sagitta','Sagittarius','Scorpius','Sculptor','Scutum','Serpens','Sextans','Taurus','Telescopium','Triangulum','Triangulum\nAustrale','Tucana','Ursa Major','Ursa Minor','Vela','Virgo','Volans','Vulpecula'],
		"planets": ["Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune"],
		"sun":"Sun",
		"moon":"Moon",
		"date": "Date &amp; Time",
		"datechange": "Change the date/time",
		"close": "close",
		"position": "Latitude &amp; Longitude",
		"positionchange": "Change the longitude/latitude",
		"N": "N",
		"E": "E",
		"S": "S",
		"W": "W",
		"keyboard": "Keyboard shortcuts:",
		"fast": "speed up",
		"stop": "stop time",
		"slow": "slow down",
		"reset": "reset time",
		"cardinalchange": "toggle cardinal points",
		"toggleaz": "toggle Az/El gridlines",
		"toggleeq": "toggle Ra/Dec gridlines",
		"togglecon": "toggle constellation lines",
		"toggleconbound": "toggle constellation boundaries",
		"togglenames": "toggle constellation names",
		"togglesol": "toggle planets/Sun/Moon",
		"power": "Powered by LCOGT"
	},{
		"code" : "es",
		"name" : "Espa&#241;ol",
		"position": "Latitud &amp; Longitud",
		"W": "O",
		"planets": ["Mercurio","Venus","Marte","J&uacute;piter","Saturno","Urano","Neptuno"],
		"sun":"Sol",
		"moon":"Luna",
		"constellations": ['Andr&oacute;meda','La M&aacute;quina neum&aacute;tica','El Ave del Para&iacute;so','Acuario','El &Aacute;guila','El Altar','Aries','Auriga','El Boyero','Caelum','La Jirafa','C&aacute;ncer','Canes Venatici','El Perro Mayor','El Perro peque&ntilde;o','Capricornio','Carina','Casiopea','El Centauro','Cefeo','Ceto','El Camale&oacute;n','El Comp&aacute;s','La Paloma','La cabellera de Berenice','La Corona Austral','La Corona Boreal','El Cuervo','La Copa','La Cruz','El Cisne','El Delf&iacute;n','El Pez dorado','El Drag&oacute;n','El Caballo','El R&iacute;o','El Horno','Los Gemelos','La Grulla','H&eacute;rcules','Reloj','Hydra','La Serpiente marina','El Indio','Lagarto','Le&oacute;n','Le&oacute; peque&ntilde;o','Conejo','La Balanza','Lobo','Lince','La Lira','La Mesa','Microscopio','El Unicornio','La Mosca','Regla','El Octante','Ofiuco','Ori&oacute;n','El Pavo','Pegaso','Perseo','El F&eacute;nix','La Paleta del Pintor','Los Peces','Pez Austral','La Popa','Br&uacute;jula','El Ret&iacute;culo','Flecha','Sagitario','El Escorpi&oacute;n','Escultor','Escudo','La Serpiente','El Sextante','Tauro','Telescopio','Tri&aacute;ngulo','El Tri&aacute;ngulo Austral','El Tuc&aacute;n','Oso Mayor','Oso Peque&ntilde;o','Vela','Virgo','El Pez volador','El Zorro']
	}];
	this.col = {
		'black':"rgb(0,0,0)",
		'white':"rgb(255,255,255)",
		'grey':"rgb(100,100,100)",
		'sun':'rgb(255,215,0)',
		'moon':'rgb(150,150,150)',
		'cardinal':'rgba(163,228,255, 1)',
		'constellation':"rgba(180,180,255,0.8)",
		'constellationboundary':"rgba(255,255,100,0.6)",
		"showers":"rgba(100,255,100,0.8)",
		'az':"rgba(100,100,255,0.4)",
		'eq':"rgba(255,100,100,0.4)"
	};

	this.input = input;

	// Overwrite with input values
	this.init(input);
	
	if(typeof this.polartype=="undefined") this.selectProjection('polar');	// Set the default

	this.changeLanguage(this.langcode);

	// Define some VirtualSky styles
	$('<style type="text/css">.virtualskyhelp { padding: 10px; background-color: white;border-radius:0.5em;-moz-border-radius:0.5em;-webkit-border-radius:0.5em; } .virtualskyhelp ul { list-style:none;margin: 0px;padding:0px; } .virtualskyinfobox { background-color:rgb(200,200,200);color:black;padding:5px;border-radius:0.5em;-moz-border-radius:0.5em;-webkit-border-radius:0.5em;box-shadow:0px 0px 20px rgba(255,255,255,0.5);-moz-box-shadow:0px 0px 20px rgba(255,255,255,0.5);-webkit-box-shadow:0px 0px 20px rgba(255,255,255,0.5);} .virtualskyinfobox img {} .virtualskyinfocredit {color: white;float:left;font-size: 0.8em;padding: 5px;position: absolute;} .virtualskyform { position:absolute;z-index:20;display:block;overflow:hidden;background-color:#ddd;padding:10px;box-shadow:0px 0px 20px rgba(255,255,255,0.6);-moz-box-shadow:0px 0px 20px rgba(255,255,255,0.6);-webkit-box-shadow:0px 0px 20px rgba(255,255,255,0.6);border-radius:0.5em;-moz-border-radius:0.5em;-webkit-border-radius:0.5em; } .virtualskydismiss { float:right;padding-left:5px;padding-right:5px;margin:0px;font-weight:bold;cursor:pointer;color:black;margin-right:-5px;margin-top:-5px; } .virtualskyform input,.virtualskyform .divider { display:inline-block;font-size:1em;text-align:center;margin-right:2px; } .virtualskyform .divider { margin-top: 5px; padding: 2px;}</style>').appendTo("head");

	this.pointers = new Array();

	// Internal variables
	this.dragging = false;
	this.x = "";
	this.y = "";
	this.theta = 0;
	this.sky_gradient;
	this.infobox = "virtualskyinfobox";
	this.container = '';
	this.now = this.clock;
	this.times = this.astronomicalTimes();
	if(this.id) this.createSky();
	var p = this.moonPos(this.times.JD);
	this.moon = p.moon;
	this.sun = p.sun;

	if(this.islive) interval = window.setInterval(function(sky){ sky.setClock('now'); },1000,this);
}
VirtualSky.prototype.init = function(d){
	if(!d) return this;
	var q = location.search;
	if(q && q != '#'){
		bits = q.replace(/^\?/,'').replace(/\&$/,'').split('&'); // remove the leading ? and trailing &
		var key,val;
		for(var i = 0; i < bits.length ; i++){
			key = bits[i].split('=')[0], val = bits[i].split('=')[1];
			// convert floats
			if(/^[0-9.\-]+$/.test(val)) val = parseFloat(val);
			if(val == "true") val = true;
			if(val == "false") val = false;
			if(typeof d[key]=="undefined") d[key] = val;
		}
	}
	var n = "number";
	var s = "string";
	var b = "boolean";
	var o = "object";
	var f = "function";
	// Overwrite defaults with variables passed to the function
	if(is(d.id,s)) this.id = d.id;
	if(is(d.projection,s)) this.selectProjection(d.projection);
	if(is(d.gradient,b)) this.gradient = d.gradient;
	if(is(d.cardinalpoints,b)) this.cardinalpoints = d.cardinalpoints;
	if(is(d.negative,b)) this.negative = d.negative;
	if(is(d.constellations,b)) this.constellations = d.constellations;
	if(is(d.constellationboundaries,b)) this.constellationboundaries = d.constellationboundaries;
	if(is(d.constellationlabels,b)) this.constellationlabels = d.constellationlabels;
	if(is(d.meteorshowers,b)) this.meteorshowers = d.meteorshowers;
	if(is(d.showstars,b)) this.showstars = d.showstars;
	if(is(d.showstarlabels,b)) this.showstarlabels = d.showstarlabels;
	if(is(d.starnames,o)) this.starnames = d.starnames;
	if(is(d.showplanets,b)) this.showplanets = d.showplanets;
	if(is(d.showplanetlabels,b)) this.showplanetlabels = d.showplanetlabels;
	if(is(d.showorbits,b)) this.showorbits = d.showorbits;
	if(is(d.showdate,b)) this.showdate = d.showdate;
	if(is(d.showposition,b)) this.showposition = d.showposition;
	if(is(d.keyboard,b)) this.keyboard = d.keyboard;
	if(is(d.mouse,b)) this.mouse = d.mouse;
	if(is(d.ground,b)) this.ground = d.ground;
	if(is(d.gridlines_az,b)) this.gridlines_az = d.gridlines_az;
	if(is(d.gridlines_eq,b)) this.gridlines_eq = d.gridlines_eq;
	if(is(d.gridstep,n)) this.gridstep = d.gridstep;
	if(is(d.magnitude,n)) this.magnitude = d.magnitude;
	if(is(d.longitude,n)) this.longitude = d.longitude;
	if(is(d.latitude,n)) this.latitude = d.latitude;
	if(is(d.clock,s)) this.clock = new Date(d.clock.replace(/%20/g,' '));
	if(is(d.clock,o)) this.clock = d.clock;
	if(is(d.background,s)) this.background = d.background;
	if(is(d.color,s)) this.color = d.color;
	if(is(d.az,n)) this.az_off = (d.az%360)-180;
	if(is(d.planets,s) || is(d.planets,o)) this.planets = d.planets;
	if(is(d.lines,s) || is(d.lines,o)) this.lines = d.lines;
	if(is(d.boundaries,s) || is(d.boundaries,o)) this.boundaries = d.boundaries;
	if(is(d.width,n)) this.wide = d.width;
	if(is(d.height,n)) this.tall = d.height;
	if(is(d.live,b)) this.islive = d.live;
	if(is(d.fullscreen,b)) this.fullscreen = d.fullscreen;
	if(is(d.credit,b)) this.credit = d.credit;
	if(is(d.transparent,b)) this.transparent = d.transparent;
	if(is(d.lang,s) && d.lang.length==2) this.langcode = d.lang;
	if(is(d.callback,o)){
		if(is(d.callback.geo,f)) this.callback.geo = d.callback.geo;
		if(is(d.callback.mouseenter,f)) this.callback.mouseenter = d.callback.mouseenter;
		if(is(d.callback.mouseout,f)) this.callback.mouseout = d.callback.mouseout;
	}
	return this;
}
VirtualSky.prototype.changeLanguage = function(code){
	for(var i = 0; i < this.langs.length ; i++){
		if(this.langs[i].code==code){ this.lang = this.langs[i]; return this; }
	}
	this.lang = this.langs[0];
	return this;
}
VirtualSky.prototype.htmlDecode = function(input){
	var e = document.createElement('div');
	e.innerHTML = input;
	return e.childNodes[0].nodeValue;
}
VirtualSky.prototype.getPhrase = function(key,key2){
	if(key=="constellations"){
		if(key2 < this.lang.constellations.length) return this.htmlDecode(this.lang.constellations[key2]);
	}else if(key=="planets"){
		if(key2 < this.lang.planets.length) return this.htmlDecode(this.lang.planets[key2]);
	}else return (this.lang[key]) ? this.lang[key] : (this.langs[0][key] ? this.langs[0][key] : "");
	return "";
}
VirtualSky.prototype.resize = function(w,h){
	if(!this.canvas) return;
	if(!w || !h){
		if(this.fullscreen){
			this.canvas.css({'width':0,'height':0});
			w = $(window).width();
			h = $(window).height();
			this.canvas.css({'width':w,'height':h});
			$(document).css({'width':w,'height':h});
		}else{
			// We have to zap the width of the canvas to let it take the width of the container
			this.canvas.css({'width':0,'height':0});
			w = this.container.outerWidth();
			h = this.container.outerHeight();
			this.canvas.css({'width':w,'height':h});
		}
	}
	if(w == this.wide && h == this.tall) return;
	this.setWH(w,h);
	this.positionCredit();
	this.updateSkyGradient();
	this.draw();
}
VirtualSky.prototype.setWH = function(w,h){
	if(!w || !h) return;
	this.c.width = w;
	this.c.height = h;
	this.wide = w;
	this.tall = h;
	// Bug fix for IE 8 which sets a width of zero to a div within the <canvas>
	if(this.ie && $.browser.version == 8) $('#'+this.id).find('div').css({'width':w,'height':h});
	this.canvas.css({'width':w,'height':h});
}
// Some pseudo-jQuery
VirtualSky.prototype.hide = function(){ this.container.hide(); return this; }
VirtualSky.prototype.show = function(){ this.container.show(); return this; }
VirtualSky.prototype.toggle = function(){ this.container.toggle(); return this; }
VirtualSky.prototype.loadJSON = function(file,callback){
	if(typeof file!=="string") return this;
	$.ajax({ dataType: "json", url: file, context: this, success: callback });
	return this;
}
VirtualSky.prototype.loadPlanets = function(file){
	return this.loadJSON(file,function(data){ this.planets = data.planets; this.draw(); });
}
VirtualSky.prototype.loadLines = function(file){
	return this.loadJSON(file,function(data){ this.lines = data.lines; this.draw(); });
}
VirtualSky.prototype.loadBoundaries = function(file){
	return this.loadJSON(file,function(data){ this.boundaries = data.boundaries; this.draw(); });
}
VirtualSky.prototype.loadMeteorShowers = function(file){
	return this.loadJSON(file,function(data){ this.showers = data.showers; this.draw(); });
}
VirtualSky.prototype.loadDeepStars = function(file){
	return this.loadJSON(file,function(data){ this.stars = this.stars.concat(data.stars); this.draw(); });
}
VirtualSky.prototype.createSky = function(){
	this.container = $('#'+this.id);
	this.times = this.astronomicalTimes();

	if(this.container.length == 0){
		// No appropriate container exists. So we'll make one.
		$('body').append('<div id="'+this.id+'"></div>');
		this.container = $('#'+this.id);
	}
	this.container.css('position','relative');
	$(window).resize({me:this},function(e){ e.data.me.resize(); });

	// Get the planet data
	if(typeof this.planets==="string") this.loadPlanets(this.planets);

	// Get the constellation line data
	if(typeof this.lines==="string") this.loadLines(this.lines);
	
	// Get the constellation line data
	if(typeof this.boundaries==="string") this.loadBoundaries(this.boundaries);
	
	// Get the faint star data
	if(typeof this.starsdeep==="string") this.loadDeepStars(this.starsdeep);

	// Get the meteor showers
	if(typeof this.showers==="string") this.loadMeteorShowers(this.showers);

	// If the Javascript function has been passed a width/height
	// those take precedence over the CSS-set values
	if(this.wide > 0) this.container.css('width',this.wide);
	this.wide = this.container.width();
	if(this.tall > 0) this.container.css('height',this.tall);
	this.tall = this.container.height();

	// Rename as the holder
	this.container.attr('id',this.id+'holder');

	// Add a <canvas> to it with the original ID
	this.container.html('<canvas id="'+this.id+'" style="display:block;"></canvas>');
	this.canvas = $('#'+this.id);
	this.c = document.getElementById(this.id);
	// For excanvas we need to initialise the newly created <canvas>
	if(this.excanvas) this.c = G_vmlCanvasManager.initElement(this.c);

	if(this.c && this.c.getContext){  
		this.setWH(this.wide,this.tall);
		this.ctx = this.c.getContext('2d');
		this.ctx.clearRect(0,0,this.wide,this.tall);
		this.ctx.beginPath();
		var fs = this.fontsize();
		this.ctx.font = ""+fs+"px Helvetica";
		this.ctx.fillStyle = 'rgb(0,0,0)';
		this.ctx.lineWidth = 1.5;
		var loading = 'Loading sky...';
		this.ctx.fillText(loading,(this.wide-this.ctx.measureText(loading).width)/2,(this.tall-fs)/2)
		this.ctx.fill();

		$("#"+this.id).bind('click',{sky:this},function(e){
			var x = e.pageX - $(this).offset().left - window.scrollX;
			var y = e.pageY - $(this).offset().top - window.scrollY;
			matched = e.data.sky.whichPointer(x,y);
			e.data.sky.toggleInfoBox(matched);
			if(matched >= 0) $(e.data.sky.canvas).css({cursor:'pointer'});
		}).bind('mousemove',{sky:this},function(e){
			var sky = e.data.sky;
			// We don't need scrollX/scrollY as pageX/pageY seem to include this
			var x = e.pageX - $(this).offset().left;
			var y = e.pageY - $(this).offset().top;
			if(sky.mouse) $(sky.canvas).css({cursor:'move'});
			if(sky.dragging && sky.mouse){
				if(sky.polartype){
					dx = x - sky.wide/2;
					dy = y - sky.tall/2;
					theta = Math.atan2(dy,dx);
					if(theta > sky.theta) sky.az_off += 2;
					else if(theta < sky.theta) sky.az_off -= 2;
					sky.az_off = sky.az_off%360;
					sky.theta = theta;
				}else{
					if(typeof sky.x=="number") sky.az_off += (sky.x-x)/2
					sky.az_off = sky.az_off%360;
				}
				sky.x = x;
				sky.y = y;
				sky.draw();
				$(sky.canvas).css({cursor:'-moz-grabbing'});
			}else{
				matched = sky.whichPointer(x,y);
				if(matched >= 0) $(sky.canvas).css({cursor:'pointer'});
				sky.toggleInfoBox(matched);
			}	
		}).bind('mousedown',{sky:this},function(e){
			e.data.sky.dragging = true;
		}).bind('mouseup',{sky:this},function(e){
			e.data.sky.dragging = false;
			e.data.sky.x = "";
		}).bind('mouseout',{sky:this},function(e){
			e.data.sky.dragging = false;
			e.data.sky.mouseover = false;
			e.data.sky.x = "";
			if(typeof e.data.sky.callback.mouseout=="function") e.data.sky.callback.mouseout.call(e.data.sky);
		}).bind('mouseenter',{sky:this},function(e){
			e.data.sky.mouseover = true;
			if(typeof e.data.sky.callback.mouseenter=="function") e.data.sky.callback.mouseenter.call(e.data.sky);
		});
		if(this.keyboard){
			$(document).bind('keypress',{sky:this},function(e){
				if(!e) e=window.event;
				sky = e.data.sky;
				if(sky.mouseover && sky.keyboard){
					var code = e.keyCode || e.charCode || e.which || 0;
					var c = String.fromCharCode(code).toLowerCase();
					if(c == 'a') sky.toggleAtmosphere();
					else if(c == 'c') sky.toggleConstellationLines();
					else if(c == 'v') sky.toggleConstellationLabels();
					else if(c == 'b') sky.toggleConstellationBoundaries();
					else if(c == 'p') sky.togglePlanetHints();
					else if(c == 'o') sky.toggleOrbits();
					else if(c == 'z') sky.toggleGridlinesAzimuthal();
					else if(c == 'e') sky.toggleGridlinesEquatorial();
					else if(c == 'g') sky.toggleGround();
					else if(c == 'i') sky.toggleNegative();
					else if(c == 'q') sky.toggleCardinalPoints();
					else if(c == 'l') sky.spinIt("up");
					else if(c == 'j') sky.spinIt("down");
					else if(c == 'k') sky.spinIt(0);
					else if(c == 'n') sky.setClock('now');
					else {
						if(code == 37 /* left */){ sky.az_off -= 2; sky.draw(); }
						else if(code == 39 /* right */){ sky.az_off += 2; sky.draw(); }
						else if(code == 63){ sky.lightbox($('<div class="virtualskyhelp"><div class="virtualskydismiss" title="close">&times;</div><span>'+sky.getPhrase('keyboard')+'</span><ul><li><strong>l</strong> = '+sky.getPhrase('fast')+'</li><li><strong>k</strong> = '+sky.getPhrase('stop')+'</li><li><strong>j</strong> = '+sky.getPhrase('slow')+'</li><li><strong>n</strong> = '+sky.getPhrase('reset')+'</li><li><strong>q</strong> = '+sky.getPhrase('cardinalchange')+'</li><li><strong>a</strong> = '+sky.getPhrase('toggleaz')+'</li><li><strong>e</strong> = '+sky.getPhrase('toggleeq')+'</li><li><strong>c</strong> = '+sky.getPhrase('togglecon')+'</li><li><strong>v</strong> = '+sky.getPhrase('togglenames')+'</li><li><strong>b</strong> = '+sky.getPhrase('toggleconbound')+'</li><li><strong>p</strong> = '+sky.getPhrase('togglesol')+'</li></ul></div>').appendTo(sky.container)); }
						else if(code == 38 /* up */){ sky.magnitude += 0.2; sky.draw(); }
						else if(code == 40 /* down */){ sky.magnitude -= 0.2; sky.draw(); }
					}
				}
			});
		}
	}
	this.draw();
}
VirtualSky.prototype.whichPointer = function(x,y){
	for(i = 0 ; i < this.pointers.length ; i++){
		if(Math.abs(x-this.pointers[i].x) < 5 && Math.abs(y-this.pointers[i].y) < 5) return i
	}
	return -1;
}
VirtualSky.prototype.toggleInfoBox = function(i){
	if(this.pointers.length == 0 || i > this.pointers.length) return this;

	if($('#'+this.id+'_'+this.infobox).length <= 0) this.container.append('<div id="'+this.id+'_'+this.infobox+'" class="virtualskyinfobox" style="display:none;"></div>');
	el = $('#'+this.id+'_'+this.infobox);
	if(i >= 0 && this.isVisible(this.pointers[i].el) && this.pointers[i].x > 0 && this.pointers[i].y > 0 && this.pointers[i].x < this.wide && this.pointers[i].y < this.tall){
		var offset = this.container.position();
		el.html(this.pointers[i].html);
		var x = this.pointers[i].x - Math.round(el.outerWidth()/2);
		var y = this.pointers[i].y - Math.round(el.outerHeight()/2);
		el.css({'position':'absolute',left:x,top:y,'z-index':10}).fadeIn("fast");
	}else{
		el.hide();
	}
}
VirtualSky.prototype.centreDiv = function(id){
	var off = $('#'+this.id).offset();
	var w = $('#'+id).outerWidth();
	var h = $('#'+id).outerHeight();
	$('#'+id).css({position:'absolute',top:(off.top+(this.tall-h)/2),left:(off.left+(this.wide-w)/2)});
}
// compute horizon coordinates from utc, ra, dec
// ra, dec, lat, lon in  degrees
// utc is a Date object
// results returned in hrz_altitude, hrz_azimuth
VirtualSky.prototype.coord2horizon = function(ra, dec){
	utc = this.now;
	// compute hour angle in degrees
	//var times = this.astronomicalTimes(utc);
	var ha = this.times.LST*15 - ra;
	if (ha < 0) ha += 360;
	// convert degrees to radians
	ha *= this.d2r;
	dec *= this.d2r;
	// Fudge to fix divide by zero error at poles
	var lat = (Math.abs(this.latitude) == 90.0) ? (this.latitude-0.00001)*this.d2r : this.latitude*this.d2r;
	// compute altitude in radians
	var alt = Math.asin(Math.sin(dec)*Math.sin(lat) + Math.cos(dec)*Math.cos(lat)*Math.cos(ha));
	// compute azimuth in radians
	// divide by zero error at poles or if alt = 90 deg
	var az  = Math.acos((Math.sin(dec) - Math.sin(alt)*Math.sin(lat))/(Math.cos(alt)*Math.cos(lat)));
	// convert radians to degrees
	var hrz_altitude = alt/this.d2r;
	var hrz_azimuth  = az/this.d2r;
	// choose hemisphere
	if (Math.sin(ha) > 0) hrz_azimuth = 360 - hrz_azimuth;
	return [hrz_altitude,hrz_azimuth];
}
VirtualSky.prototype.selectProjection = function(proj){
	if(this.projections[proj]){
		this.projection = this.projections[proj];
		this.projection.id = proj;
		this.fullsky = (typeof this.projection.fullsky=="boolean") ? this.projection.fullsky : false;
		this.polartype = (typeof this.projection.polartype=="boolean") ? this.projection.polartype : false;
	}
}
VirtualSky.prototype.isVisible = function(el){
	if(!this.fullsky) return (el > 0);
	else return (this.ground) ? (el > 0) : true;
}
// Return a structure with the Julian Date, Local Sidereal Time and Greenwich Sidereal Time
VirtualSky.prototype.astronomicalTimes = function(clock,lon){
	if(typeof clock=="undefined") clock = this.now;
	if(typeof lon=="undefined") lon = this.longitude;
	JD = this.getJD(clock);
	JD0 = Math.floor(JD-0.5)+0.5;
	S = JD0-2451545.0;
	T = S/36525.0;
	T0 = (6.697374558 + (2400.051336*T) + (0.000025862*T*T))%24;
	if(T0 < 0) T0 += 24;
	UT = (((clock.getUTCMilliseconds()/1000 + clock.getUTCSeconds())/60) + clock.getUTCMinutes())/60 + clock.getUTCHours();
	A = UT*1.002737909;
	T0 += A;
	GST = T0%24;
	if(GST < 0) GST += 24;
	d = (GST + lon/15.0)/24.0;
	d = d - Math.floor(d);
	if(d < 0) d += 1;
	LST = 24.0*d;
	return { GST:GST, LST:LST, JD:JD };
}
// Uses algorithm defined in Practical Astronomy (4th ed) by Peter Duffet-Smith and Jonathan Zwart
VirtualSky.prototype.moonPos = function(JD,sun){
	d2r = this.d2r;
	if(typeof JD=="undefined") JD = this.times.JD;
	if(typeof sun=="undefined") sun = this.sunPos(JD);
	lo = 91.929336;	// Moon's mean longitude at epoch 2010.0
	Po = 130.143076;	// mean longitude of the perigee at epoch
	No = 291.682547;	// mean longitude of the node at the epoch
	i = 5.145396;	// inclination of Moon's orbit
	e = 0.0549;	// eccentricity of the Moon's orbit
	l = (13.1763966*sun.D + lo)%360;
	if(l < 0) l += 360;
	Mm = (l - 0.1114041*sun.D - Po)%360;
	if(Mm < 0) Mm += 360;
	N = (No - 0.0529539*sun.D)%360;
	if(N < 0) N += 360;
	C = l-sun.lon;
	Ev = 1.2739*Math.sin((2*C-Mm)*d2r);
	sinMo = Math.sin(sun.Mo*d2r);
	Ae = 0.1858*sinMo;
	A3 = 0.37*sinMo;
	Mprimem = Mm + Ev -Ae - A3;
	Ec = 6.2886*Math.sin(Mprimem*d2r);
	A4 = 0.214*Math.sin(2*Mprimem*d2r);
	lprime = l + Ev + Ec -Ae + A4;
	V = 0.6583*Math.sin(2*(lprime-sun.lon)*d2r);
	lprimeprime = lprime + V;
	Nprime = N - 0.16*sinMo;
	lppNp = (lprimeprime-Nprime)*d2r;
	sinlppNp = Math.sin(lppNp);
	y = sinlppNp*Math.cos(i*d2r);
	x = Math.cos(lppNp);
	lm = Math.atan2(y,x)/d2r + Nprime;
	Bm = Math.asin(sinlppNp*Math.sin(i*d2r))/d2r;
	if(lm > 360) lm -= 360;
	return { moon: {lon:lm,lat:Bm}, sun:sun };
}
// Uses algorithm defined in Practical Astronomy (4th ed) by Peter Duffet-Smith and Jonathan Zwart
VirtualSky.prototype.sunPos = function(JD){
	D = (JD-2455196.5);	// Number of days since the epoch of 2010 January 0.0
	// Calculated for epoch 2010.0. If T is the number of Julian centuries since 1900 January 0.5 = (JD-2415020.0)/36525
	eg = 279.557208;	// mean ecliptic longitude in degrees = (279.6966778 + 36000.76892*T + 0.0003025*T*T)%360;
	wg = 283.112438;	// longitude of the Sun at perigee in degrees = 281.2208444 + 1.719175*T + 0.000452778*T*T;
	e = 0.016705;	// eccentricity of the Sun-Earth orbit in degrees = 0.01675104 - 0.0000418*T - 0.000000126*T*T;
	N = ((360/365.242191)*D)%360;
	if(N < 0) N += 360;
	Mo = (N + eg - wg)%360	// mean anomaly in degrees
	if(Mo < 0) Mo += 360;
	v = Mo + (360/Math.PI)*e*Math.sin(Mo*Math.PI/180);
	lon = v + wg;
	if(lon > 360) lon -= 360;
	lat = 0;
	return {lat:lat,lon:lon,Mo:Mo,D:D,N:N}
}
// Input is Julian Date
// Uses method defined in Practical Astronomy (4th ed) by Peter Duffet-Smith and Jonathan Zwart
VirtualSky.prototype.meanObliquity = function(JD){
	if(!JD) JD = this.times.JD;
	T = (JD-2451545.0)/36525	// centuries since 2451545.0 (2000 January 1.5)
	T2 = T*T;
	T3 = T2*T;
	return 23.4392917 - 0.0130041667*T - 0.00000016667*T2 + 0.0000005027778*T3;
}
// Take input in decimal degrees, decimal Sidereal Time and decimal latitude
// Uses method defined in Practical Astronomy (4th ed) by Peter Duffet-Smith and Jonathan Zwart
VirtualSky.prototype.ecliptic2azel = function(l,b,LST,lat){
	if(!LST){
		this.times = this.astronomicalTimes();
		LST = this.times.LST;
	}
	if(!lat) lat = this.latitude
	l *= this.d2r;
	b *= this.d2r;
	var sl = Math.sin(l);
	var cl = Math.cos(l);
	var sb = Math.sin(b);
	var cb = Math.cos(b);
	var v = [cl*cb,sl*cb,sb];
	var e = this.meanObliquity();
	e *= d2r;
	ce = Math.cos(e);
	se = Math.sin(e);
	var Cprime = [[1.0,0.0,0.0],[0.0,ce,-se],[0.0,se,ce]];
	var s = this.vectorMultiply(Cprime,v);
	ST = LST*15*this.d2r;
	var cST = Math.cos(ST);
	var sST = Math.sin(ST);
	var B = [[cST,sST,0],[sST,-cST,0],[0,0,1]];
	var r = this.vectorMultiply(B,s);
	lat *= this.d2r;
	var sphi = Math.sin(lat);
	var cphi = Math.cos(lat);
	var A = [[-sphi,0,cphi],[0,-1,0],[cphi,0,sphi]];
	var w = this.vectorMultiply(A,r);
	var theta = Math.atan2(w[1],w[0]);
	var psi = Math.asin(w[2]);
	return {az:theta/this.d2r,el:psi/this.d2r}
}
// Take input in decimal degrees
VirtualSky.prototype.ecliptic2radec = function(l,b,JD){
	var e = this.meanObliquity();
	l *= this.d2r;
	b *= this.d2r;
	e *= this.d2r;
	var sl = Math.sin(l);
	var cl = Math.cos(l);
	var sb = Math.sin(b);
	var cb = Math.cos(b);
	var tb = Math.tan(b);
	var se = Math.sin(e);
	var ce = Math.cos(e);
	ra = Math.atan2((sl*ce - tb*se),(cl));
	dec = Math.asin(sb*ce+cb*se*sl);
	return { ra:ra/this.d2r, dec:dec/this.d2r };
}
// Returns [x, y (,elevation)]
VirtualSky.prototype.ecliptic2xy = function(l,b,LST){
	if(typeof LST=="undefined") LST = this.times.LST;
	if(this.fullsky){
		var pos = this.ecliptic2radec(l,b);
		return this.radec2xy(pos.ra,pos.dec);
	}else{
		var pos = this.ecliptic2azel(l,b,LST);
		el = pos.el;
		pos = this.azel2xy(pos.az-this.az_off,pos.el,this.wide,this.tall);
		pos.el = el;
		return pos;
	}
	return 0;
}
// Returns [x, y (,elevation)]
VirtualSky.prototype.radec2xy = function(ra,dec){
	if(typeof this.projection.radec2xy==="function") return this.projection.radec2xy.call(this,ra,dec);
	else{
		var coords = this.coord2horizon(ra, dec);
		// Only return coordinates above the horizon
		if(coords[0] > 0){
			pos = this.azel2xy(coords[1]-this.az_off,coords[0],this.wide,this.tall);
			return {x:pos.x,y:pos.y,az:coords[1],el:coords[0]};
		}
	}
	return 0;
}
// Input is a two element position (degrees) and rotation matrix
// Output is a two element position (degrees)
VirtualSky.prototype.Transform = function(p, rot){
	p[0] *= this.d2r;
	p[1] *= this.d2r;
	var cp1 = Math.cos(p[1]);
	var m = [Math.cos(p[0])*cp1, Math.sin(p[0])*cp1, Math.sin(p[1])];
	var s = [m[0]*rot[0] + m[1]*rot[1] + m[2]*rot[2], m[0]*rot[3] + m[1]*rot[4] + m[2]*rot[5], m[0]*rot[6] + m[1]*rot[7] + m[2]*rot[8] ];
	var r = Math.sqrt(s[0]*s[0] + s[1]*s[1] + s[2]*s[2]); 
	var b = Math.asin(s[2]/r); // Declination in range -90 -> +90
	var cb = Math.cos(b);
	var a = Math.atan2(((s[1]/r)/cb),((s[0]/r)/cb));
	if (a < 0) a += Math.PI*2;
	return [a*this.r2d,b*this.r2d];
}
// Convert from B1875 to J2000
// Using B = 1900.0 + (JD ??? 2415020.31352) / 365.242198781 and p73 Practical Astronomy With A Calculator
VirtualSky.prototype.fk1tofk5 = function(a,b){
	// Convert from B1875 -> J2000
	return this.Transform([a,b], [0.9995358730015703, -0.02793693620138929, -0.012147682028606801, 0.027936935758478665, 0.9996096732234282, -0.00016976035344812515, 0.012147683047201562, -0.00016968744936278707, 0.9999261997781408]);
}
VirtualSky.prototype.azel2xy = function(az,el){
	var w = this.wide;
	var h = this.tall;
	if(az < 0) az += 360;

	return this.projection.azel2xy(az,el,w,h,this);
}
VirtualSky.prototype.vectorMultiply = function(A,B){
	if(B.length > 0){
		// 2D or 1D
		if(B[0].length > 0) return [[(A[0][0]*B[0][0]+A[0][1]*B[1][0]+A[0][2]*B[2][0]),(A[0][0]*B[0][1]+A[0][1]*B[1][1]+A[0][2]*B[2][1]),(A[0][0]*B[0][2]+A[0][1]*B[1][2]+A[0][2]*B[2][2])],[(A[1][0]*B[0][0]+A[1][1]*B[1][0]+A[1][2]*B[2][0]),(A[1][0]*B[0][1]+A[1][1]*B[1][1]+A[1][2]*B[2][1]),(A[1][0]*B[0][2]+A[1][1]*B[1][2]+A[1][2]*B[2][2])],[(A[2][0]*B[0][0]+A[2][1]*B[1][0]+A[2][2]*B[2][0]),(A[2][0]*B[0][1]+A[2][1]*B[1][1]+A[2][2]*B[2][1]),(A[2][0]*B[0][2]+A[2][1]*B[1][2]+A[2][2]*B[2][2])]];
		else return [(A[0][0]*B[0] + A[0][1]*B[1] + A[0][2]*B[2]),(A[1][0]*B[0] + A[1][1]*B[1] + A[1][2]*B[2]),(A[2][0]*B[0] + A[2][1]*B[1] + A[2][2]*B[2])];
	}
}
VirtualSky.prototype.setFont = function(){ this.ctx.font = this.fontsize()+"px "+this.canvas.css('font-family'); }
VirtualSky.prototype.fontsize = function(){
	var m = Math.min(this.wide,this.tall);
	var f = parseInt(this.container.css('font-size'));
	if(typeof f!=="number") f = 12;
	return (m < 500) ? ((m < 350) ? ((m < 300) ? ((m < 250) ? 9 : 10) : 11) : 12) : f;
}
VirtualSky.prototype.positionCredit = function(){
	var off = this.container.position();
	this.container.find('.'+this.id+'_credit').css({position:'absolute',top:off.top+parseFloat(this.tall)-5-this.fontsize(),left:off.left+5});
}
VirtualSky.prototype.updateSkyGradient = function(){
	this.sky_gradient = this.ctx.createLinearGradient(0,0,0,this.tall);
	this.sky_gradient.addColorStop(0.0, 'rgba(0,30,50,0.1)');  
	this.sky_gradient.addColorStop(0.7, 'rgba(0,30,50,0.35)');  
	this.sky_gradient.addColorStop(1, 'rgba(0,50,80,0.6)');
}
VirtualSky.prototype.draw = function(proj){

	// Don't bother drawing anything if there is no physical area to draw on
	if(this.wide <= 0 || this.tall <= 0) return this;
	if(!(this.c && this.c.getContext)) return this;

	if(typeof proj!="undefined") this.selectProjection(proj);
	var white = this.col.white;
	var black = this.col.black;

	// Shorthands
	var c = this.ctx;
	var d = this.container;

	c.moveTo(0,0);
	c.clearRect(0,0,this.wide,this.tall);
	c.fillStyle = (this.polartype || this.fullsky) ? this.background : ((this.negative) ? white : black);
	c.fillRect(0,0,this.wide,this.tall);
	c.fill();

	if(this.polartype){
		c.moveTo(this.wide/2,this.tall/2);
		c.closePath();
		c.beginPath();
		c.arc(this.wide/2,this.tall/2,-0.5+this.tall/2,0,Math.PI*2,true);
		c.closePath();
		if(!this.transparent){
			c.fillStyle = (this.gradient && !this.negative) ? "rgba(0,15,30, 1)" : ((this.negative) ? white : black);
			c.fill();
		}
		c.lineWidth = 0.5;
		c.strokeStyle = black;
		c.stroke();
	}else if(typeof this.projection.draw==="function") this.projection.draw.call(this);

	this.now = this.clock;

	tmp = c.fillStyle;
	c.beginPath();
	if(this.gradient && !this.polartype && !this.fullsky && !this.negative){
		if(typeof this.sky_gradient == "undefined") this.updateSkyGradient();
		c.fillStyle = this.sky_gradient;
		// draw shapes
		c.fillRect(0,0,this.wide,this.tall);
		c.fill();
	}
	
	this.drawStars().drawPlanets().drawConstellationLines().drawConstellationBoundaries().drawMeteorShowers().drawCardinalPoints().drawGridlines("az").drawGridlines("eq");

	for(i = 0; i < this.pointers.length ; i++) this.highlight(i);

	var txtcolour = (this.color!="") ? (this.color) : ((this.negative) ? black : white);
	if(this.polartype || this.projection.altlabeltext) txtcolour = (this.color!="") ? txtcolour : this.col.grey;
	fontsize = this.fontsize();

	c.fillStyle = txtcolour;
	c.lineWidth = 1.5;
	this.setFont();

	// Time line
	if(this.showdate){
		var clockstring = this.clock.toDateString()+' '+this.clock.toLocaleTimeString();
		var metric_clock = this.drawText(clockstring,5,5+fontsize);
	}

	// Position line
	if(this.showposition){
		var positionstring = Math.abs(this.latitude).toFixed(2) + ((this.latitude>0) ? this.getPhrase('N') : this.getPhrase('S')) + ', ' + Math.abs(this.longitude).toFixed(2) + ((this.longitude>0) ? this.getPhrase('E') : this.getPhrase('W'));
		var metric_pos = this.drawText(positionstring,5,5+fontsize+fontsize);
	}

	// Credit line
	if(this.credit){
		var credit = this.getPhrase('power');
		var metric_credit = this.drawText(credit,5,this.tall-5);
		// Float a transparent link on top of the credit text
		if(d.find('.'+this.id+'_credit').length == 0) d.append('<div class="'+this.id+'_credit"><a href="http://lcogt.net/virtualsky" target="_parent" title="Created by the Las Cumbres Observatory Global Telescope">'+this.getPhrase('powered')+'</a></div>');
		d.find('.'+this.id+'_credit').css({padding:0,zIndex:20,display:'block',overflow:'hidden',backgroundColor:'transparent'});
		d.find('.'+this.id+'_credit a').css({display:'block',width:Math.ceil(metric_credit)+'px',height:fontsize+'px','font-size':fontsize+'px'});
		this.positionCredit();
	}
	if(this.container.find('.'+this.id+'_clock').length == 0){
		this.container.append('<div class="'+this.id+'_clock" title="'+this.getPhrase('datechange')+'">'+clockstring+'</div>');
		var off = $('#'+this.id).position();
		this.container.find('.'+this.id+'_clock').css({position:'absolute',padding:0,width:metric_clock,cursor:'pointer',top:off.top+5,left:off.left+5,zIndex:20,display:'block',overflow:'hidden',backgroundColor:'transparent',fontSize:fontsize+'px',color:'transparent'}).bind('click',{sky:this},function(e){
			var s = e.data.sky;
			var id = s.id;
			if($('#'+id+'_calendar').length == 0){
				var off = $('#'+id).offset();
				var w = 280;
				var h = 50;
				if(s.wide < w) w = s.wide;
				s.container.append('<div id="'+id+'_calendar" class="virtualskyform"><div style="" id="'+id+'_calendar_close" class="virtualskydismiss" title="close">&times;</div><div style="text-align:center;margin:2px;">'+e.data.sky.getPhrase('date')+'</div><div style="text-align:center;"><input type="text" id="'+id+'_year" style="width:3.2em;" value="" /><div class="divider">/</div><input type="text" id="'+id+'_month" style="width:1.6em;" value="" /><div class="divider">/</div><input type="text" id="'+id+'_day" style="width:1.6em;" value="" /><div class="divider">&nbsp;</div><input type="text" id="'+id+'_hours" style="width:1.6em;" value="" /><div class="divider">:</div><input type="text" id="'+id+'_mins" style="width:1.6em;" value="" /></div></div>');
				$('#'+id+'_calendar').css({width:w});
				$('#'+id+'_calendar input').bind('change',{sky:s},function(e){
					e.data.sky.clock = new Date(parseInt($('#'+id+'_year').val()), parseInt($('#'+id+'_month').val()-1), parseInt($('#'+id+'_day').val()), parseInt($('#'+id+'_hours').val()), parseInt($('#'+id+'_mins').val()), 0,0);
					e.data.sky.advanceTime(0,0);
				});
			}
			s.lightbox($('#'+id+'_calendar'));
			$('#'+id+'_year').val(s.clock.getFullYear());
			$('#'+id+'_month').val(s.clock.getMonth()+1);
			$('#'+id+'_day').val(s.clock.getDate());
			$('#'+id+'_hours').val(s.clock.getHours());
			$('#'+id+'_mins').val(s.clock.getMinutes());
		});
	}
	if($('#'+this.id+'_position').length == 0){
		this.container.append('<div id="'+this.id+'_position" title="'+this.getPhrase('positionchange')+'">'+positionstring+'</div>');
		var off = $('#'+this.id).position();
		$('#'+this.id+'_position').css({position:'absolute',padding:0,width:metric_pos,cursor:'pointer',top:off.top+5+fontsize,left:off.left+5,zIndex:20,fontSize:fontsize+'px',display:'block',overflow:'hidden',backgroundColor:'transparent',fontSize:fontsize+'px',color:'transparent'});
		$('#'+this.id+'_position').bind('click',{sky:this},function(e){
			var s = e.data.sky;
			var id = s.id;
			if($('#'+id+'_geo').length == 0){
				var w = 310;
				var narrow = '';
				if(s.wide < w){
					narrow = '<br style="clear:both;margin-top:20px;" />';
					w = w/2;
				}
				s.container.append('<div id="'+id+'_geo" class="virtualskyform"><div id="'+id+'_geo_close" class="virtualskydismiss" title="close">&times;</div><div style="text-align:center;margin:2px;">'+s.getPhrase('position')+'</div><div style="text-align:center;"><input type="text" id="'+id+'_lat" value="" style="padding-right:10px!important;"><div class="divider">'+s.getPhrase('N')+'</div>'+narrow+'<input type="text" id="'+id+'_long" value="" /><div class="divider">'+s.getPhrase('E')+'</div></div></div>');
				$('#'+id+'_geo').css({width:w,'align':'center'})
				$('#'+id+'_geo input').css({width:'6em'});
				$('#'+id+'_geo_close').bind('click',{sky:s},function(e){
					e.data.sky.latitude = parseFloat($('#'+id+'_lat').val())
					e.data.sky.longitude = parseFloat($('#'+id+'_long').val())
					e.data.sky.draw();
				});
			}
			s.lightbox($('#'+id+'_geo'));
			$('#'+id+'_lat').val(s.latitude)
			$('#'+id+'_long').val(s.longitude)
			if(typeof s.callback.geo=="function") s.callback.geo.call(s);
		});
	}
	return this;
} 
VirtualSky.prototype.lightbox = function(lb){
	if(!lb.length) return this;
	lb.css({'z-index': 100,'position': 'absolute'});
	if(this.container.find('.virtualsky_bg').length == 0) this.container.append('<div class="virtualsky_bg" style="position:absolute;z-index: 99;left:0px;top: 0px;right: 0px;bottom: 0px;background-color: rgba(0,0,0,0.7);"></div>')
	bg = this.container.find('.virtualsky_bg').show();
	lb.css({left:((this.wide-lb.outerWidth())/2)+'px',top:((this.tall-lb.outerHeight())/2)+'px'}).show();
	this.container.find('.virtualskydismiss').click({lb:lb,bg:bg},function(e){ lb.remove(); bg.remove(); });
	bg.click({lb:lb,bg:bg},function(e){ lb.hide(); bg.hide(); }).css({'height':this.container.height()+'px'});
	return this;
}
VirtualSky.prototype.drawStars = function(){
	if(!this.showstars && !this.showstarlabels) return this;
	this.ctx.beginPath();
	this.ctx.fillStyle = (this.negative) ? this.col.black : this.col.white;
	this.az_off = (this.az_off+360)%360;
	var mag;
	for(i = 0; i < this.stars.length; i++){
		if(this.stars[i][1] < this.magnitude){
			mag = this.stars[i][1];
			var p = this.radec2xy(this.stars[i][2], this.stars[i][3]);
			if(this.isVisible(p.el) && !isNaN(p.x)){
				d = 0.8*Math.max(3-mag/2, 0.5);
				// Modify the 'size' of the star by how close to the horizon it is
				// i.e. smaller when closer to the horizon
				if(this.gradient && !this.fullsky){
					z = (90-p.el)*this.d2r;
					d *= Math.exp(-z*0.6)
				}
				this.ctx.moveTo(p.x+d,p.y);
				if(this.showstars) this.ctx.arc(p.x,p.y,d,0,Math.PI*2,true);
				if(this.showstarlabels){
					for(var j = 0; j < this.starnames.length ; j++){
						if(this.starnames[j][0] == this.stars[i][0]){
							this.drawLabel(p.x,p.y,d,"",this.starnames[j][1]);
							continue;
						}
					}
				}
			}
		}	
	}
	this.ctx.fill();
	return this;
}
// When provided with an array of Julian dates, ra, dec, and magnitude this will interpolate to the nearest
// data = [jd_1, ra_1, dec_1, mag_1, jd_2, ra_2, dec_2, mag_2....]
VirtualSky.prototype.interpolate = function(jd,data){
	var mindt = jd;	// Arbitrary starting value in days
	var mini = 0;	// index where we find the minimum
	for(var i = 0 ; i < data.length ; i+=4){
		// Find the nearest point to now
		var dt = (jd-data[i]);
		if(Math.abs(dt) < Math.abs(mindt)){ mindt = dt; mini = i; }
	}
	if(mindt >= 0){
		var pos_2 = mini+1+4;
		var pos_1 = mini+1;
		var fract = mindt/Math.abs(data[pos_2-1]-data[pos_1-1]);
	}else{
		var pos_2 = mini+1;
		var pos_1 = mini+1-4;
		var fract = (1+(mindt)/Math.abs(data[pos_2-1]-data[pos_1-1]));
	}
	// We don't want to attempt to find positions beyond the edges of the array
	if(pos_2 > data.length || pos_1 < 0){
		var dra = data[mini+1];
		var ddec = data[mini+2];
		var dmag = data[mini+3];
	}else{
		var dra = (Math.abs(data[pos_2]-data[pos_1]) > 180) ? (data[pos_1]+(data[pos_2]+360-data[pos_1])*fract)%360 : (data[pos_1]+(data[pos_2]-data[pos_1])*fract)%360;
		var ddec = data[pos_1+1]+(data[pos_2+1]-data[pos_1+1])*fract;
		var dmag = data[pos_1+2]+(data[pos_2+2]-data[pos_1+2])*fract;
	}
	return { ra: dra, dec:ddec, mag:dmag}
}
VirtualSky.prototype.drawPlanets = function(){

	if(!this.showplanets && !this.showplanetlabels && !this.showorbits) return this;
	if(!this.planets || this.planets.length <= 0) return this;
	var oldjd = this.jd;
	this.jd = this.times.JD;

	for(var p = 0 ; p < this.planets.length ; p++){
		// We'll allow 2 formats here:
		// [Planet name,colour,ra,dec,mag] or [Planet name,colour,[jd_1, ra_1, dec_1, mag_1, jd_2, ra_2, dec_2, mag_2....]]
		if(!this.planets[p]) continue;
		if(this.planets[p].length == 3){
			// Find nearest JD
			if(this.planets[p][2].length%4 == 0){
				if(this.jd > this.planets[p][2][0] && this.jd < this.planets[p][2][(this.planets[p][2].length-4)]){
					var interp = this.interpolate(this.jd,this.planets[p][2]);
					var ra = interp.ra;
					var dec = interp.dec;
					var mag = interp.mag;
				}else{
					continue;	// We don't have data for this planet so skip to the next
				}
			}
		}else{
			var ra = this.planets[p][2];
			var dec = this.planets[p][3];
		}
		var pos = this.radec2xy(ra,dec);


		var colour = this.planets[p][1];
		if(this.negative) colour = this.col.grey;

		if((this.showplanets || this.showplanetlabels) && this.isVisible(pos.el) && mag < this.magnitude){
			var d = 0;
			if(typeof mag!="undefined"){
				d = 0.8*Math.max(3-mag/2, 0.5);
				if(this.gradient && !this.fullsky){
					z = (90-pos.el)*this.d2r;
					d *= Math.exp(-z*0.6)
				}
			}
			if(d < 1.5) d = 1.5;
			this.drawPlanet(pos.x,pos.y,d,colour,p);
		}
		if(this.showorbits && this.isVisible(pos.el) && mag < this.magnitude){
			this.ctx.beginPath();
			this.ctx.lineWidth = 0.5
			this.setFont();
			this.ctx.strokeStyle = this.planets[p][1];
			this.ctx.lineWidth = 1;
			var previous = {x:0,y:0,el:0};
			for(i = 0 ; i < this.planets[p][2].length-4 ; i+=4){
				var point = this.radec2xy(this.planets[p][2][i+1], this.planets[p][2][i+2]);
				if(previous.x > 0 && previous.y > 0 && this.isVisible(point.el)){
					this.ctx.moveTo(previous.x,previous.y);
					// Basic error checking: points behind us often have very long lines so we'll zap them
					if(Math.abs(point.x-previous.x) < this.wide/3){
						this.ctx.lineTo(point.x,point.y);
					}
				}
				previous = point;
			}
			this.ctx.stroke();
		}
	}
	
	// Moon
	if(this.showplanets || this.showplanetlabels){
		// Only recalculate the Moon's ecliptic position if the time has changed
		if(oldjd != this.jd){
			var p = this.moonPos(this.jd);
			this.moon = p.moon;
			this.sun = p.sun;
		}
		var pos;
		// Draw the Sun
		pos = this.ecliptic2xy(this.sun.lon,this.sun.lat,this.times.LST);
		if(this.isVisible(pos.el)) this.drawPlanet(pos.x,pos.y,5,this.col.sun,"sun");
		pos = this.ecliptic2xy(this.moon.lon,this.moon.lat,this.times.LST);
		// Draw Moon last as it is closest
		if(this.isVisible(pos.el)) this.drawPlanet(pos.x,pos.y,5,this.col.moon,"moon");

	}
	return this;
}
VirtualSky.prototype.drawPlanet = function(x,y,d,colour,label){
	this.ctx.beginPath();
	this.ctx.fillStyle = colour;
	this.ctx.strokeStyle = colour;
	this.ctx.moveTo(x+d,y+d);
	if(this.showplanets) this.ctx.arc(x,y,d,0,Math.PI*2,true);
	label = (typeof label==="string") ? this.getPhrase(label) : this.getPhrase('planets',label);
	if(this.showplanetlabels) this.drawLabel(x,y,d,colour,label);
	this.ctx.fill();
	return this;
}
VirtualSky.prototype.drawText = function(txt,x,y){
	this.ctx.beginPath(); 
	this.ctx.fillText(txt,x,y);
	return this.ctx.measureText(txt).width;
}
// Helper function. You'll need to wrap it with a this.ctx.beginPath() and a this.ctx.fill();
VirtualSky.prototype.drawLabel = function(x,y,d,colour,label){
	if(colour.length > 0) this.ctx.fillStyle = colour;
	this.ctx.lineWidth = 1.5;
	var xoff = d + 2;
	if((this.polartype) && this.ctx.measureText) xoff = -this.ctx.measureText(label).width-3
	if((this.polartype) && x < this.wide/2) xoff = d;
	this.ctx.fillText(label,x+xoff,y-(d+2))
	return this;
}
VirtualSky.prototype.drawConstellationLines = function(colour){
	if(!(this.constellations || this.constellationlabels)) return this;
	if(!colour) colour = (this.negative) ? this.col.black : this.col.constellation;
	this.ctx.beginPath();
	this.ctx.strokeStyle = colour;
	this.ctx.fillStyle = colour;
	this.ctx.lineWidth = 0.75
	var fontsize = this.fontsize();
	this.setFont();
	if(typeof this.lines==="string") return this;
	var posa, posb;
	for(var c = 0; c < this.lines.length; c++){
		if(this.constellations){
			for(l = 3; l < this.lines[c].length; l+=2){
				var a = -1;
				var b = -1;
				if(!this.hipparcos[this.lines[c][l]]){
					for(s = 0; s < this.stars.length; s++){
						if(this.stars[s][0] == this.lines[c][l]){
							this.hipparcos[this.lines[c][l]] = s;
							break;
						}
					}
				}
				if(!this.hipparcos[this.lines[c][l+1]]){
					for(s = 0; s < this.stars.length; s++){
						if(this.stars[s][0] == this.lines[c][l+1]){
							this.hipparcos[this.lines[c][l+1]] = s;
							break;
						}
					}
				}
				a = this.hipparcos[this.lines[c][l]];
				b = this.hipparcos[this.lines[c][l+1]];
				if(a >= 0 && b >= 0 && a < this.stars.length && b < this.stars.length){
					posa = this.radec2xy(this.stars[a][2], this.stars[a][3]);
					posb = this.radec2xy(this.stars[b][2], this.stars[b][3]);
					if(this.isVisible(posa.el) && this.isVisible(posb.el)){
						// Basic error checking: constellations behind us often have very long lines so we'll zap them
						if(Math.abs(posa.x-posb.x) < this.tall/3 && Math.abs(posa.y-posb.y) < this.tall/3){
							this.ctx.moveTo(posa.x,posa.y);
							this.ctx.lineTo(posb.x,posb.y);
						}
					}
				}
			}
		}

		if(this.constellationlabels){
			pos = this.radec2xy(this.lines[c][1],this.lines[c][2]);
			if(this.isVisible(pos.el)){
				label = this.getPhrase('constellations',c);
				xoff = (this.ctx.measureText) ? -this.ctx.measureText(label).width/2 : 0;
				this.ctx.fillText(label,pos.x+xoff,pos.y-fontsize/2)
				this.ctx.fill();
			}
		}
	}
	this.ctx.stroke();
	return this;
}
VirtualSky.prototype.drawConstellationBoundaries = function(colour){
	if(!this.constellationboundaries) return this;
	if(!colour) colour = (this.negative) ? this.col.black : this.col.constellationboundary;
	this.ctx.beginPath();
	this.ctx.strokeStyle = colour;
	this.ctx.fillStyle = colour;
	this.ctx.lineWidth = 0.75
	if(typeof this.lines==="string") return this;
	var posa, posb;
	var ra,dc,dra,ddc,b3;
	var n = 5;
	if(this.constellationboundaries){
		for(var c = 0; c < this.boundaries.length; c++){
			if(typeof this.boundaries!=="string" && c < this.boundaries.length){

				var points = [];
				for(var l = 1; l < this.boundaries[c].length; l+=2){
					b = [this.boundaries[c][l],this.boundaries[c][l+1]];
					if(l > 1){
						ra = (b[0]-a[0])%360;
						if(ra > 180) ra = ra-360;
						if(ra < -180) ra = ra+360;
						dc = (b[1]-a[1]);

						n = 5;
						if(ra/2 > n) n = parseInt(ra);
						if(dc/2 > n) n = parseInt(dc);
						
						dra = ra/n;
						ddc = dc/n;
						
						for(var i = 1; i <= n; i++){
							ra = a[0]+(i*dra);
							if(ra < 0) ra += 360;
							dc = a[1]+(i*ddc);
							points.push([ra,dc]);
						}
					}
					a = b;
				}
				posa = null;
				// Now loop over joining the points
				for(var i = 0; i < points.length; i++){
					b = this.fk1tofk5(points[i][0],points[i][1]);
					posb = this.radec2xy(b[0], b[1]);
					if(posa && this.isVisible(posa.el) && this.isVisible(posb.el)){
						// Basic error checking: constellations behind us often have very long lines so we'll zap them
						if(Math.abs(posa.x-posb.x) < this.tall/3 && Math.abs(posa.y-posb.y) < this.tall/3){
							this.ctx.moveTo(posa.x,posa.y);
							this.ctx.lineTo(posb.x,posb.y);
						}
					}
					posa = posb;
				}
			}
		}
	}
	this.ctx.stroke();
	return this;
}
VirtualSky.prototype.drawMeteorShowers = function(colour){
	if(!this.meteorshowers || typeof this.showers==="string") return this;
	if(!colour) colour = (this.negative) ? this.col.black : this.col.showers;
	var shower, pos, label, xoff, c, d, p, start, end, dra, ddc, f;
	c = this.ctx;
	c.beginPath();
	c.strokeStyle = colour;
	c.fillStyle = colour;
	c.lineWidth = 0.75;
	var fs = this.fontsize();
	this.setFont();
	var y = this.clock.getFullYear();
	for(var s in this.showers){
		d = this.showers[s].date;
		p = this.showers[s].pos;
		start = new Date(y,d[0][0]-1,d[0][1]);
		end = new Date(y,d[1][0]-1,d[1][1]);
		if(start > end && this.clock < start) start = new Date(y-1,d[0][0]-1,d[0][1]);
		if(this.clock > start && this.clock < end){
			dra = (p[1][0]-p[0][0]);
			ddc = (p[1][1]-p[0][1]);
			f = (this.clock-start)/(end-start);
			pos = this.radec2xy(this.showers[s].pos[0][0]+(dra*f),this.showers[s].pos[0][1]+(ddc*f));
			if(this.isVisible(pos.el)){
				label = this.htmlDecode(this.showers[s].name);
				xoff = (c.measureText) ? -c.measureText(label).width/2 : 0;
				c.moveTo(pos.x+2,pos.y);
				c.arc(pos.x,pos.y,2,0,Math.PI*2,true);
				c.fillText(label,pos.x+xoff,pos.y-fs/2);
			}
		}
	}
	c.fill();
	return this;
}
// type can be "az" or "eq"
VirtualSky.prototype.drawGridlines = function(type,step,colour){
	if(!type) return this;
	az = (type=="az");
	if((az && !this.gridlines_az) || (!az && !this.gridlines_eq)) return this;
	if(!colour || typeof colour!="string") colour = (az) ? this.col.az : this.col.eq;
	if(!step || typeof step!="number") step = this.gridstep;
	var a = 0;
	var b = 0;
	var c = this.ctx;
	var oldx = 0;
	var oldy = 0;
	c.beginPath(); 
	c.strokeStyle = colour;
	c.lineWidth = 1.0;
	var bstep = 2;
	if(az){
		var maxb = (typeof this.projection.maxb==="number") ? this.projection.maxb : 90-bstep;
		var minb = 0;
	}else{
		var maxb = 90-bstep;
		var minb = -maxb;
	}
	for(a = 0 ; a < 360 ; a += step){
		moved = false;
		for(b = minb; b <= maxb ; b+= bstep){
			pos = (az) ? this.azel2xy(a-this.az_off,b,this.wide,this.tall) : this.radec2xy(a,b);
			x = pos.x;
			y = pos.y;
			show = (az) ? true: ((this.isVisible(pos.el)) ? true : false);
			if(show){
				if(isFinite(x) && isFinite(y)){
					if(az){
						if(b == 0) c.moveTo(x,y);
						else c.lineTo(x,y);
					}else{
						if(!moved || Math.abs(oldx-x) > this.wide/2){
							c.moveTo(x,y);
							moved = true;
						}else c.lineTo(x,y);
					}
				}
				oldx = x;
				oldy = y;
			}
		}
	}
	c.stroke();
	c.beginPath(); 
	if(az){
		minb = 0;
		maxb = 90-bstep;
	}else{
		minb = -90+step;
		maxb = 90;
	}
	for(b = minb; b < maxb ; b+= step){
		moved = false;
		for(a = 0 ; a <= 360 ; a += bstep){
			pos = (az) ? this.azel2xy(a-this.az_off,b,this.wide,this.tall) : this.radec2xy(a,b);
			x = pos.x;
			y = pos.y;
			show = (az) ? true: ((this.isVisible(pos.el)) ? true : false);
			if(show){
				if(isFinite(x) && isFinite(y)){
					if(az){
						if(a == 0) c.moveTo(x,y);
						c.lineTo(x,y);
					}else{
						// If the last point on this contour is more than a canvas width away
						// it is probably supposed to be behind us so we won't draw a line 
						if(!moved || Math.abs(oldx-x) > this.tall/4 || Math.abs(oldy-y) > this.tall/4){
							c.moveTo(x,y);
							moved = true;
						}else c.lineTo(x,y);
						oldx = x;
						oldy = y;
					}
				}
			}
		}
	}
	c.stroke();
	return this;
}
VirtualSky.prototype.drawCardinalPoints = function(){
	if(!this.cardinalpoints) return this;
	var azs = new Array(0,90,180,270);
	var dirs = [this.getPhrase('N'),this.getPhrase('E'),this.getPhrase('S'),this.getPhrase('W')];
	var pt = 15;
	this.ctx.beginPath();
	this.ctx.fillStyle = (this.negative) ? this.col.black : this.col.cardinal;
	var fontsize = this.fontsize();
	for(var i  = 0 ; i < azs.length ; i++){
		//fontsize = pt/Math.pow(dirs[i].length,0.2);
		this.ctx.font = fontsize+"px Helvetica";

		if(this.ctx.measureText){
			var metrics = this.ctx.measureText(dirs[i]);
			var r = (metrics.width > fontsize) ? metrics.width/2 : fontsize/2;
		}else{
			var r = fontsize/2;
		}
		if(this.polartype){
			var theta = (azs[i]-this.az_off)*Math.PI/180;
			var x = -((this.tall/2) - r*1.5)*Math.sin(theta);
			var y = -((this.tall/2) - r*1.5)*Math.cos(theta);
			x = isFinite(x) ? this.wide/2 + x - r : 0;
			y = isFinite(y) ? this.tall/2 + y + r: 0;
		}else{
			pos = this.azel2xy(azs[i]-this.az_off,0,this.wide,this.tall);
			var x = isFinite(pos.x) ? pos.x - r : 0;
			var y = isFinite(pos.y) ? pos.y - pt/2 : 0;
			if(x < 0 || x > this.wide-pt) x = -r;
			var ang = (azs[i]-this.az_off)*Math.PI/180;
		}
		if(x > 0) this.ctx.fillText(dirs[i],x,y);
	}
	this.ctx.fill();
	return this;
}
// Assume decimal Ra/Dec
VirtualSky.prototype.highlight = function(i,colour){
	if(this.pointers[i].ra && this.pointers[i].dec){
		colour = (this.pointers[i].colour) ? this.pointers[i].colour : ((colour) ? colour : "rgba(255,0,0,1)");
		if(this.negative) colour = this.getNegative(colour);
		var pos = this.radec2xy(this.pointers[i].ra, this.pointers[i].dec);
		var c = this.ctx;
		if(this.isVisible(pos.el)){
			this.pointers[i].az = pos.az;
			this.pointers[i].el = pos.el;
			this.pointers[i].x = pos.x;
			this.pointers[i].y = pos.y;
			this.pointers[i].d = 5;
			c.fillStyle = colour;
			c.strokeStyle = colour;
			c.beginPath(); 
			c.fillRect(this.pointers[i].x-d/2,this.pointers[i].y-d/2,5,5);
			c.font = "10px Helvetica";
			c.lineWidth = 1.5;
			c.fill();
			c.fillText(this.pointers[i].label,this.pointers[i].x+this.pointers[i].d*1.4,this.pointers[i].y+this.pointers[i].d*0.7)
		}
	}
	return this;
}
// Expects a latitude,longitude string (comma separated)
VirtualSky.prototype.setGeo = function(pos){
	pos = pos.split(',');
	this.latitude = pos[0];
	this.longitude = pos[1];
	return this;
}
VirtualSky.prototype.liveSky = function(pos){
	this.islive = !this.islive;
	if(this.islive) interval = window.setInterval(function(sky){ sky.setClock('now'); },1000,this);
	else{
		if(typeof interval!="undefined") clearInterval(interval);
	}
	return this;
}
// Increment the clock by the amount specified
VirtualSky.prototype.advanceTime = function(by,wait){
	if(!wait) wait = 50;
	if(typeof by=="undefined") this.clock = new Date();
	else{
		this.setClock(parseFloat(by));
		clearTimeout(this.timer_time)
		this.timer_time = window.setTimeout(function(mysky,by,wait){ mysky.advanceTime(by,wait); },wait,this,by,wait);
	}
	this.times = this.astronomicalTimes();
	return this;
}
VirtualSky.prototype.setClock = function(seconds){
	if(typeof seconds=="string" && seconds=='now'){	
		if(!this.input.clock) this.clock = new Date();
		else {
			this.clock = (typeof this.input.clock==="string") ? this.input.clock.replace(/%20/g,' ') : this.input.clock;
			if(typeof this.clock=="string") this.clock = new Date(this.clock);
		}
	}else if(typeof seconds=="object"){
		this.clock = seconds;
		this.now = this.clock;
	}else this.clock = new Date(this.clock.getTime() + seconds*1000);
	this.now = this.clock;
	this.times = this.astronomicalTimes();
	this.draw();
	return this;
}
VirtualSky.prototype.toggleAtmosphere = function(){ this.gradient = !this.gradient; this.draw(); return this; }
VirtualSky.prototype.toggleNegative = function(){ this.negative = !this.negative; this.draw(); return this; }
VirtualSky.prototype.toggleConstellationLines = function(){ this.constellations = !this.constellations; this.draw(); return this; }
VirtualSky.prototype.toggleConstellationBoundaries = function(){ this.constellationboundaries = !this.constellationboundaries; this.draw(); return this; }
VirtualSky.prototype.toggleMeteorShowers = function(){ this.meteorshowers = !this.meteorshowers; this.draw(); return this; }
VirtualSky.prototype.toggleCardinalPoints = function(){ this.cardinalpoints = !this.cardinalpoints; this.draw(); return this; }
VirtualSky.prototype.toggleGridlinesAzimuthal = function(){ this.gridlines_az = !this.gridlines_az; this.draw(); return this; }
VirtualSky.prototype.toggleGround = function(){ this.ground = !this.ground; this.draw(); return this; }
VirtualSky.prototype.togglePlanetHints = function(){ this.showplanets = !this.showplanets; this.draw(); return this; }
VirtualSky.prototype.toggleOrbits = function(){ this.showorbits = !this.showorbits; this.draw(); return this; }
VirtualSky.prototype.toggleConstellationLabels = function(){ this.constellationlabels = !this.constellationlabels; this.draw(); return this; }
VirtualSky.prototype.toggleGridlinesEquatorial = function(){ this.gridlines_eq = !this.gridlines_eq; this.draw(); return this; }
VirtualSky.prototype.toggleAzimuthMove = function(az){
	if(this.az_step == 0){
		this.az_step = (typeof az=="number") ? az : -1;
		this.moveIt();
	}else{
		this.az_step = 0;
		if(typeof this.timer_az!="undefined") clearTimeout(this.timer_az)
	}
	return this;
}
VirtualSky.prototype.addPointer = function(input){
	// Check if we've already added this
	var matched = -1;
	for(var i = 0 ; i < this.pointers.length ; i++){
		if(this.pointers[i].ra == input.ra && this.pointers[i].dec == input.dec && this.pointers[i].label == input.label) matched = i;
	}
	// Hasn't been added already
	if(matched < 0){
		input.ra *= 1;	// Correct for a bug
		input.dec *= 1;
		i = this.pointers.length;
		this.pointers[i] = input;
		if(!this.pointers[i].html){
			style = (this.pointers[i].url) ? "" : "width:128px;height:128px;";
			url = (this.pointers[i].url) ? this.pointers[i].url : "http://server1.wikisky.org/v2?ra="+(this.pointers[i].ra/15)+"&de="+(this.pointers[i].dec)+"&zoom=6&img_source=DSS2";
			img = (this.pointers[i].img) ? this.pointers[i].img : 'http://server7.sky-map.org/imgcut?survey=DSS2&w=128&h=128&ra='+(this.pointers[i].ra/15)+'&de='+this.pointers[i].dec+'&angle=0.25&output=PNG';
			label = (this.pointers[i].credit) ? this.pointers[i].credit : "View in Wikisky";
			credit = (this.pointers[i].credit) ? this.pointers[i].credit : "DSS2/Wikisky";
			this.pointers[i].html =  (this.pointers[i].html) ? this.pointers[i].html : '<div class="virtualskyinfocredit"><a href="'+url+'" style="color: white;">'+credit+'<\/a><\/div><a href="'+url+'" style="display:block;'+style+'"><img src="'+img+'" style="border:0px;'+style+'" title="'+label+'" \/><\/a>';
		}
	}
	return (this.pointers.length);
}
VirtualSky.prototype.changeAzimuth = function(inc){
	this.az_off += (typeof inc=="number") ? inc : 5;
	this.draw();
	return this;
}
VirtualSky.prototype.moveIt = function(){
	// Send 'this' context to the setTimeout function so we can redraw
	this.timer_az = window.setTimeout(function(mysky){ mysky.az_off += mysky.az_step; mysky.draw(); mysky.moveIt(); },100,this);
	return this;
}
VirtualSky.prototype.spinIt = function(tick,wait){
	if(typeof tick == "number") this.spin = (tick == 0) ? 0 : (this.spin+tick);
	else{
		if(this.spin == 0) this.spin = (tick == "up") ? 2 : -2;
		else{
			if(this.spin > 0) this.spin = (tick == "up") ? (this.spin*2) : (this.spin/2);
			else if(this.spin < 0) this.spin = (tick == "up") ? (this.spin/2) : (this.spin*2);
			if(this.spin < 2 && this.spin > -2) this.spin = 0;
		}
	}
	if(typeof this.timer_time!="undefined") clearTimeout(this.timer_time);
	if(this.spin != 0) this.advanceTime(this.spin,wait);
	return this;
}
VirtualSky.prototype.getOffset = function(el){
	var _x = 0;
	var _y = 0;
	while( el && !isNaN( el.offsetLeft ) && !isNaN( el.offsetTop ) ) {
		_x += el.offsetLeft - el.scrollLeft;
		_y += el.offsetTop - el.scrollTop;
		el = el.parentNode;
	}
	return { top: _y, left: _x };
}
VirtualSky.prototype.getJD = function(today) {
	// The Julian Date of the Unix Time epoch is 2440587.5
	if(!today) today = this.clock;
	return ( today.getTime() / 86400000.0 ) + 2440587.5;
}
VirtualSky.prototype.getNegative = function(colour){
	var end = (colour.indexOf("rgb") == 0) ? (colour.lastIndexOf(")")) :  0;
	if(end == 0) return colour;
	var rgb = colour.substring(colour.indexOf("(")+1,end).split(",");
	return (rgb.length==3) ? ('rgb('+(255-rgb[0])+','+(255-rgb[1])+','+(255-rgb[2])+')') : ('rgba('+(255-rgb[0])+','+(255-rgb[1])+','+(255-rgb[2])+','+(rgb[3])+')');
}

$.virtualsky = function(placeholder,input) {
	if(typeof input=="object") input.container = placeholder;
	else {
		if(placeholder){
			if(typeof placeholder=="string") input = { container: placeholder };
			else input = placeholder;
		}else{
			input = {};
		}
	}
	input.plugins = $.virtualsky.plugins;
	return new VirtualSky(input);
};
$.virtualsky.plugins = [];
})(jQuery);
