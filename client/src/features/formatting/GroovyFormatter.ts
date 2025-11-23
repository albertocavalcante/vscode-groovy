import { LanguageClient } from 'vscode-languageclient/node';
import { DocumentFormattingRequest, TextEdit } from 'vscode-languageserver-protocol';

export class GroovyFormatter {
    constructor(private readonly client: LanguageClient) {}

    async formatDocument(documentUri: string, options: any): Promise<TextEdit[] | null> {
        const params = {
            textDocument: { uri: documentUri },
            options: options
        };

        return this.client.sendRequest(DocumentFormattingRequest.type, params);
    }
}
