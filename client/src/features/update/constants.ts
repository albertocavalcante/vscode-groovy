/**
 * Constants for the update feature
 */

// HTTP Status Codes
export const HTTP_STATUS_OK = 200;
export const HTTP_STATUS_REDIRECT_MIN = 300;
export const HTTP_STATUS_REDIRECT_MAX = 400;
export const HTTP_STATUS_CLIENT_ERROR_MIN = 400;

// Timeouts (in milliseconds)
export const DOWNLOAD_TIMEOUT_MS = 60000; // 60 seconds
export const API_REQUEST_TIMEOUT_MS = 30000; // 30 seconds
export const INITIAL_CHECK_DELAY_MS = 5000; // 5 seconds

// Time conversions
export const MILLISECONDS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_TO_MS = MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

// Default values
export const DEFAULT_CHECK_INTERVAL_HOURS = 24;
export const MINIMUM_CHECK_INTERVAL_HOURS = 1;

// Version parsing
export const SEMVER_COMPONENT_COUNT = 3; // major.minor.patch
