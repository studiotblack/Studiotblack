"use client";
import { createContext, useContext, useState, ReactNode } from "react";

// All available menus in the system
export const ALL_MENUS = [
  { href: "/dashboard",     label: "Dashboard"      },
  { href: "/agenda",        label: "Agenda"         },
  { href: "/clientes",      label: "Clientes"       },
  { href: "/servicos",      label: "Serviços"       },
  { href: "/produtos",      label: "Produtos"       },
  { href: "/financeiro",    label: "Financeiro"     },
  { href: "/performance",   label: "Performance"    },
  { href: "/colaboradores", label: "Colaboradores"  },
  { href: "/relatorios",    label: "Relatórios"     },
  { href: "/configuracoes", label: "Configurações"  },
];

export interface Usuario {
  id: string;
  nome: string;
  cargo: string;
  cor: string;
  isAdmin: boolean;
  permissoes: string[]; // array of menu href strings
}

// Initial users — admin has all, others have selective access
export const usuariosIniciais: Usuario[] = [
  {
    id: "u-admin",
    nome: "Administrador",
    cargo: "Admin",
    cor: "#d4af8c",
    isAdmin: true,
    permissoes: ALL_MENUS.map((m) => m.href),
  },
  {
    id: "c1",
    nome: "Bruna",
    cargo: "Estética",
    cor: "#d4b896",
    isAdmin: false,
    permissoes: ["/dashboard", "/agenda", "/performance"],
  },
  {
    id: "c2",
    nome: "Wallacy",
    cargo: "Barbeiro",
    cor: "#c9a96e",
    isAdmin: false,
    permissoes: ["/dashboard", "/agenda", "/performance"],
  },
  {
    id: "c3",
    nome: "Henrique",
    cargo: "Barbeiro",
    cor: "#e8c99a",
    isAdmin: false,
    permissoes: ["/dashboard", "/agenda", "/performance"],
  },
  {
    id: "c4",
    nome: "Vanessa",
    cargo: "Cabeleireira",
    cor: "#b5936a",
    isAdmin: false,
    permissoes: ["/dashboard", "/agenda", "/performance"],
  },
  {
    id: "c5",
    nome: "Tiago",
    cargo: "Barbeiro",
    cor: "#a07850",
    isAdmin: false,
    permissoes: ["/dashboard", "/agenda", "/performance"],
  },
];

interface AuthContextType {
  usuarioAtivo: Usuario;
  setUsuarioAtivo: (u: Usuario) => void;
  usuarios: Usuario[];
  setUsuarios: (u: Usuario[] | ((prev: Usuario[]) => Usuario[])) => void;
  temPermissao: (href: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarioAtivo, setUsuarioAtivo] = useState<Usuario>(usuariosIniciais[0]);
  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosIniciais);

  const temPermissao = (href: string) => {
    if (usuarioAtivo.isAdmin) return true;
    return usuarioAtivo.permissoes.includes(href);
  };

  return (
    <AuthContext.Provider value={{ usuarioAtivo, setUsuarioAtivo, usuarios, setUsuarios, temPermissao }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
