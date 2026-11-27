// Exporta o recorte do Zammad que os testes usam (grupos, atributos de ticket e Core Workflows) para um JSON em
// shared/__fixtures__ (lido por fem-schema-live.ts). So LEITURAS (GET). Sem dados pessoais: grava so os campos que
// o plugin le.
//
// Uso (PowerShell, na pasta do plugin):
//   $env:ZAMMAD_URL = "https://colabora.fem.edu.br"; $env:ZAMMAD_API_TOKEN = "<token>"
//   node scripts/export-zammad-schema.mjs [saida.json]
// Padrao: shared/__fixtures__/fem-schema-live.json. Depois, ajustar a data no comentario de fem-schema-live.ts.
// O token nunca e impresso nem gravado. Mensagens sem acento (encoding do console).

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = process.env.ZAMMAD_URL?.trim().replace(/\/+$/, "");
const token = process.env.ZAMMAD_API_TOKEN?.trim();
if (!baseUrl || !token) {
  console.error("Defina ZAMMAD_URL e ZAMMAD_API_TOKEN no ambiente.");
  process.exit(1);
}

const output = resolve(process.argv[2] ?? "shared/__fixtures__/fem-schema-live.json");

async function get(path) {
  const response = await fetch(`${baseUrl}/api/v1/${path}`, {
    headers: { Authorization: `Token token=${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`GET ${path} respondeu ${response.status}`);
  return response.json();
}

const pick = (object, keys) => Object.fromEntries(keys.filter((key) => key in object).map((key) => [key, object[key]]));

const [groups, attributes, workflows] = await Promise.all([get("groups"), get("object_manager_attributes"), get("core_workflows")]);

const schema = {
  groups: groups.map((group) => pick(group, ["id", "name", "name_last", "parent_id", "active", "note"])),
  attributes: attributes
    .filter((attribute) => attribute.object === "Ticket")
    .map((attribute) => pick(attribute, ["name", "object", "display", "data_type", "active", "editable", "position", "data_option", "screens"])),
  workflows: workflows
    .filter((workflow) => workflow.object === "Ticket")
    .map((workflow) =>
      pick(workflow, ["id", "name", "active", "object", "priority", "stop_after_match", "preferences", "condition_selected", "condition_saved", "perform"]),
    ),
  fetchedAt: new Date().toISOString(),
};

// JSON (nao um literal TypeScript): um objeto deste tamanho pesa no typecheck e no lint. O .ts ao lado so o tipa.
await writeFile(output, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
console.log(`Recorte gravado em ${output}: ${schema.groups.length} grupos, ${schema.attributes.length} atributos, ${schema.workflows.length} workflows.`);
