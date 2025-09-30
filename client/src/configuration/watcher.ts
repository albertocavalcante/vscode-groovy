import { workspace, Disposable } from 'vscode';
import { affectsJavaConfiguration, affectsCompilationConfiguration, affectsServerConfiguration } from './settings';
import { restartClient } from '../server/client';
import { logger } from '../utils/logger';

/**
 * Sets up configuration change watchers
 */
export function setupConfigurationWatcher(): Disposable {
    return workspace.onDidChangeConfiguration(async (event) => {
        // Restart server if Java configuration changed
        if (affectsJavaConfiguration(event)) {
            logger.info('Java configuration changed, restarting server...');
            await restartClient();
            return;
        }

        // Restart server if compilation configuration changed
        if (affectsCompilationConfiguration(event)) {
            logger.info('Compilation configuration changed, restarting server...');
            await restartClient();
            return;
        }

        // Restart server if other server configuration changed
        if (affectsServerConfiguration(event)) {
            logger.info('Server configuration changed, restarting server...');
            await restartClient();
            return;
        }
    });
}