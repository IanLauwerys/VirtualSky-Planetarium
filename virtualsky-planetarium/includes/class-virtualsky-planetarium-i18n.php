<?php

/**
 * Define the internationalization functionality
 *
 * Loads and defines the internationalization files for this plugin
 * so that it is ready for translation.
 *
 * @link       https://www.blackwaterskies.co.uk/wordpress-virtualsky-planetarium-plugin/
 * @since      1.0.0
 *
 * @package    Virtualsky_Planetarium
 * @subpackage Virtualsky_Planetarium/includes
 */

/**
 * Define the internationalization functionality.
 *
 * Loads and defines the internationalization files for this plugin
 * so that it is ready for translation.
 *
 * @since      1.0.0
 * @package    Virtualsky_Planetarium
 * @subpackage Virtualsky_Planetarium/includes
 * @author     Ian Lauwerys <ian.lauwerys@gmail.com>
 */
class Virtualsky_Planetarium_i18n {


	/**
	 * Load the plugin text domain for translation.
	 *
	 * @since    1.0.0
	 */
	public function load_plugin_textdomain() {

		load_plugin_textdomain(
			'virtualsky-planetarium',
			false,
			dirname( dirname( plugin_basename( __FILE__ ) ) ) . '/languages/'
		);

	}



}
