<?php

/**
 * The plugin bootstrap file
 *
 * This file is read by WordPress to generate the plugin information in the plugin
 * admin area. This file also includes all of the dependencies used by the plugin,
 * registers the activation and deactivation functions, and defines a function
 * that starts the plugin.
 *
 * @link              https://www.blackwaterskies.co.uk/wordpress-virtualsky-planetarium-plugin/
 * @since             1.0.0
 * @package           Virtualsky_Planetarium
 *
 * @wordpress-plugin
 * Plugin Name:       virtualsky-planetarium
 * Plugin URI:        https://www.blackwaterskies.co.uk/wordpress-virtualsky-planetarium-plugin/
 * Description:       This is a short description of what the plugin does. It's displayed in the WordPress admin area.
 * Version:           1.0.0
 * Author:            Ian Lauwerys
 * Author URI:        https://www.blackwaterskies.co.uk/wordpress-virtualsky-planetarium-plugin/
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       virtualsky-planetarium
 * Domain Path:       /languages
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

/**
 * Currently plugin version.
 * Start at version 1.0.0 and use SemVer - https://semver.org
 * Rename this for your plugin and update it as you release new versions.
 */
define( 'VIRTUALSKY_PLANETARIUM_VERSION', '1.0.0' );

/**
 * The code that runs during plugin activation.
 * This action is documented in includes/class-virtualsky-planetarium-activator.php
 */
function activate_virtualsky_planetarium() {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-virtualsky-planetarium-activator.php';
	Virtualsky_Planetarium_Activator::activate();
}

/**
 * The code that runs during plugin deactivation.
 * This action is documented in includes/class-virtualsky-planetarium-deactivator.php
 */
function deactivate_virtualsky_planetarium() {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-virtualsky-planetarium-deactivator.php';
	Virtualsky_Planetarium_Deactivator::deactivate();
}

register_activation_hook( __FILE__, 'activate_virtualsky_planetarium' );
register_deactivation_hook( __FILE__, 'deactivate_virtualsky_planetarium' );

/**
 * The core plugin class that is used to define internationalization,
 * admin-specific hooks, and public-facing site hooks.
 */
require plugin_dir_path( __FILE__ ) . 'includes/class-virtualsky-planetarium.php';

/**
 * Begins execution of the plugin.
 *
 * Since everything within the plugin is registered via hooks,
 * then kicking off the plugin from this point in the file does
 * not affect the page life cycle.
 *
 * @since    1.0.0
 */
function run_virtualsky_planetarium() {

	$plugin = new Virtualsky_Planetarium();
	$plugin->run();

}
run_virtualsky_planetarium();
