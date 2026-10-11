import type { IncomingMessage, ServerResponse } from "node:http";

// Contrato estrutural do handler: o runtime é fornecido pela própria Vercel.
// Não precisamos instalar o builder completo só para importar dois tipos.
export interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
}
export interface VercelResponse extends ServerResponse {
  status(code: number): this;
  send(body: string | undefined): this;
}
