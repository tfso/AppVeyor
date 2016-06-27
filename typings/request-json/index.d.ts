declare module "request-json" {

    export class JsonClient {
        post(url: string, data: any, cb: any): void;
        sendFile(attachmentName: string, data: any, cb: any): void;
    }

    export function createClient(url: string): JsonClient;
}