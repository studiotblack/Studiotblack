"use client";

import { useEffect, useRef, useState } from "react";
import type { CategoriaFinanceira, TipoCategoria } from "@/lib/financeiro-data";

function normalizar(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// ── Combobox de categoria: digita e já filtra por nome/grupo/código, agrupado por
// "grupo" (mesma divisão usada em Cadastros → Categorias), e oferece criar uma categoria
// nova na hora quando a busca não bate com nenhuma existente. Sempre abre PRA BAIXO com
// altura travada e rolagem própria — o <select> nativo, com 200+ opções, às vezes abria
// pra cima e estourava a tela.
export default function CategoriaCombobox({
  categorias, tipo, value, onChange, onCriada, placeholder,
}: {
  categorias: CategoriaFinanceira[];
  tipo: TipoCategoria;
  value: string;
  onChange: (categoriaId: string) => void;
  onCriada?: (nova: CategoriaFinanceira) => void;
  placeholder?: string;
}) {
  const categoriasFiltradas = categorias.filter((c) => c.tipo === tipo);
  const selecionada = categoriasFiltradas.find((c) => c.id === value);

  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
        setBusca("");
      }
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, []);

  const buscaNorm = normalizar(busca.trim());
  const filtradas = buscaNorm
    ? categoriasFiltradas.filter(
        (c) =>
          normalizar(c.nome).includes(buscaNorm) ||
          normalizar(c.grupo || "").includes(buscaNorm) ||
          normalizar(c.codigo || "").includes(buscaNorm)
      )
    : categoriasFiltradas;

  // Agrupa mantendo a ordem de primeira aparição de cada grupo.
  const grupos: { nome: string; itens: CategoriaFinanceira[] }[] = [];
  for (const c of filtradas) {
    const nomeGrupo = c.grupo || "Outras";
    let g = grupos.find((g) => g.nome === nomeGrupo);
    if (!g) {
      g = { nome: nomeGrupo, itens: [] };
      grupos.push(g);
    }
    g.itens.push(c);
  }

  const jaExisteExata = categoriasFiltradas.some((c) => normalizar(c.nome) === buscaNorm);

  const criarCategoria = async () => {
    if (!busca.trim()) return;
    setCriando(true);
    setErroCriar("");
    try {
      const res = await fetch("/api/financeiro/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo: "Outras", nome: busca.trim(), tipo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const nova = await res.json();
      onChange(nova.id);
      onCriada?.(nova);
      setAberto(false);
      setBusca("");
    } catch (err: any) {
      setErroCriar(err.message || "Erro ao criar categoria");
    } finally {
      setCriando(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={aberto ? busca : selecionada?.nome || ""}
        onFocus={() => setAberto(true)}
        onChange={(e) => {
          setBusca(e.target.value);
          setAberto(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setAberto(false);
            setBusca("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder || "Buscar categoria..."}
        style={{ width: "100%" }}
      />
      {aberto && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: 260,
            overflowY: "auto",
            zIndex: 50,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          {value && !buscaNorm && (
            <div
              onClick={() => {
                onChange("");
                setAberto(false);
              }}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.8rem",
                color: "var(--color-muted)",
                cursor: "pointer",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              Sem categoria
            </div>
          )}
          {grupos.map((g) => (
            <div key={g.nome}>
              <div
                style={{
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  color: "var(--color-gold)",
                  background: "rgba(212,175,140,0.07)",
                }}
              >
                {g.nome}
              </div>
              {g.itens.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    onChange(c.id);
                    setAberto(false);
                    setBusca("");
                  }}
                  style={{
                    padding: "0.4rem 0.75rem 0.4rem 1.25rem",
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    background: c.id === value ? "var(--color-gold)" : "transparent",
                    color: c.id === value ? "var(--color-bg)" : "var(--color-cream)",
                  }}
                >
                  {c.nome}
                </div>
              ))}
            </div>
          ))}
          {filtradas.length === 0 && (
            <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "var(--color-muted)" }}>
              Nenhuma categoria encontrada.
            </div>
          )}
          {busca.trim() && !jaExisteExata && (
            <div
              onClick={criarCategoria}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.82rem",
                cursor: "pointer",
                color: "var(--color-gold)",
                borderTop: "1px solid var(--color-border)",
                fontWeight: 700,
              }}
            >
              {criando ? "Criando..." : `+ Criar categoria "${busca.trim()}"`}
            </div>
          )}
          {erroCriar && (
            <div style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem", color: "var(--color-danger)" }}>{erroCriar}</div>
          )}
        </div>
      )}
    </div>
  );
}
