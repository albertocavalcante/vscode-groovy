import * as vscode from 'vscode';
import { GradleExecutionService } from './GradleExecutionService';
import { GroovyTestController } from './GroovyTestController';
import { TestService } from './TestService';
import { getClient } from '../../server/client';

export function registerTestingFeatures(
  context: vscode.ExtensionContext,
  logger: vscode.OutputChannel,
) {
  const executionService = new GradleExecutionService(
    logger,
    context.extensionPath,
  );

  // Get the LanguageClient for test discovery
  const client = getClient();
  const testService = client ? new TestService(client) : undefined;

  new GroovyTestController(context, executionService, testService);
}
