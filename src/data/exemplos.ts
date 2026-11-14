// Dados de exemplo (fictícios) para conhecer o site. Todos levam exemplo = true,
// então "Apagar exemplos" remove só eles e nunca os seus dados reais.

import type { Store, Item } from "./store";
import { newId, nowIso } from "./validate";
import { toDateStr } from "./dates";
import { addDays } from "./sessoes";
import { deleteAllMateriais } from "./materiais";

const NOW = () => nowIso();

export async function criarExemplos(db: Store): Promise<void> {
  const areaId = newId();
  const cursoId = newId();
  const agora = NOW();
  const dt = (n: number) => toDateStr(addDays(new Date(), n));
  const mod = (titulo: string, feito: boolean) => ({
    id: newId(),
    titulo,
    concluido: feito,
    concluidoEm: feito ? agora : null,
  });

  const itens: Item[] = [
    {
      sk: `AREA#${areaId}`,
      tipo: "AREA",
      nome: "Exemplo · Redes",
      descricao: "Área de exemplo. Pode apagar quando quiser.",
      cor: "blue",
      ordem: 999,
      exemplo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    {
      sk: `CURSO#${cursoId}`,
      tipo: "CURSO",
      areaId,
      nome: "Exemplo · Fundamentos de redes",
      plataforma: "Cisco Networking Academy",
      url: "https://www.netacad.com/",
      status: "em_andamento",
      prioridade: "media",
      descricao: "Curso de exemplo para ver módulos, progresso e materiais.",
      modulos: [
        mod("Modelo OSI e TCP/IP", true),
        mod("Endereçamento IPv4", true),
        mod("Sub-redes (subnetting)", false),
        mod("Switching e VLANs", false),
        mod("Roteamento estático", false),
      ],
      exemplo: true,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    {
      sk: `MAT#${cursoId}#${newId()}`,
      tipo: "MATERIAL",
      tipoMaterial: "lab",
      titulo: "Exemplo · Montar uma rede com 2 VLANs no Packet Tracer",
      url: "",
      feito: false,
      criadoEm: agora,
    },
    {
      sk: `REC#${newId()}`,
      tipo: "RECORRENTE",
      titulo: "Exemplo · Estudo de redes",
      hora: "19:00",
      duracaoMin: 60,
      dias: [1, 3],
      desde: dt(0),
      ate: dt(28),
      alvo: { tipo: "curso", id: cursoId, nome: "Exemplo · Fundamentos de redes", areaId },
      nota: "",
      exemplo: true,
      criadoEm: agora,
    },
    {
      sk: `EVT#${dt(7)}T--#${newId()}`,
      tipo: "EVENTO",
      tipoEvento: "prazo",
      titulo: "Exemplo · Revisar sub-redes",
      duracaoMin: 0,
      alvo: { tipo: "curso", id: cursoId, nome: "Exemplo · Fundamentos de redes", areaId },
      nota: "",
      concluido: false,
      exemplo: true,
      criadoEm: agora,
    },
  ];

  for (const it of itens) await db.putItem(it, { mustNotExist: true });
}

/** Apaga só os itens marcados como exemplo (e os materiais dos cursos de exemplo). */
export async function apagarExemplos(db: Store): Promise<number> {
  const prefixos = ["AREA#", "CURSO#", "CERT#", "REC#", "EVT#"];
  let total = 0;
  for (const p of prefixos) {
    const itens = await db.queryPrefix(p);
    for (const it of itens) {
      if (it.exemplo !== true || typeof it.sk !== "string") continue;
      if (p === "CURSO#") await deleteAllMateriais(db, it.sk.slice(p.length));
      await db.deleteItem(it.sk);
      total++;
    }
  }
  return total;
}
