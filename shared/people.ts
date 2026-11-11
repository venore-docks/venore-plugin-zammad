import "server-only";
import { zammadRequest } from "./zammad-client";

// Pessoas do Zammad (solicitante, agente) por id, com o token da integração (não em nome da pessoa: um
// colaborador comum não pode ler o cadastro de outros). Cache em memória: nome e e-mail mudam pouco.
type ZammadPerson = { id: number; email?: string | null; firstname?: string | null; lastname?: string | null };
export type Person = { id: number; email: string | null; name: string };

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<number, { at: number; person: Person | null }>();

export async function getPerson(id: number): Promise<Person | null> {
  if (!Number.isInteger(id) || id <= 1) return null;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.person;
  const result = await zammadRequest<ZammadPerson>(`users/${id}`);
  let person: Person | null = null;
  if (result.success) {
    const email = result.data.email ? result.data.email.trim().toLowerCase() : null;
    const name = [result.data.firstname, result.data.lastname].filter(Boolean).join(" ").trim();
    person = { id, email, name: name || email || `Pessoa #${id}` };
  }
  cache.set(id, { at: Date.now(), person });
  return person;
}

export async function getPeople(ids: number[]): Promise<Map<number, Person>> {
  const unique = [...new Set(ids)].filter((id) => id > 1);
  const found = await Promise.all(unique.map((id) => getPerson(id)));
  const map = new Map<number, Person>();
  found.forEach((person, index) => {
    if (person) map.set(unique[index], person);
  });
  return map;
}
