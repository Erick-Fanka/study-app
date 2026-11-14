<p align="center">
  <img src="public/icon-512.png" width="112" alt="study.app" />
</p>

<h1 align="center">study.app</h1>

<p align="center">
  Organizador pessoal de estudos: cursos, certificações, simulados, agenda e tempo de estudo.
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-0B0B0F?logo=react&logoColor=61DAFB" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-0B0B0F?logo=typescript&logoColor=3178C6" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-build-0B0B0F?logo=vite&logoColor=FFC517" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-instal%C3%A1vel-16A34A" />
  <img alt="Licença MIT" src="https://img.shields.io/badge/licen%C3%A7a-MIT-2563EB" />
</p>

---

## ✨ O que ele faz

| | Área | Funcionalidades |
|---|---|---|
| 🏠 | **Início** | Dias seguidos estudando, horas na semana, cursos em andamento, próximo prazo, avisos de prazos, horas por área e por semana |
| 📚 | **Cursos** | Áreas → Cursos → Módulos, progresso, "onde parei", status automático, materiais e labs, colar lista de módulos |
| 🏅 | **Certificações** | Domínios com peso, prova, voucher, credencial, validade; simulados em % ou acertos/total com tabela colorida e gráfico de evolução |
| 📅 | **Agenda** | Blocos de estudo (únicos ou semanais) e prazos; provas, vouchers e validades aparecem sozinhos; visões Próximos, Dia, Semana e Mês |
| ⏱️ | **Tempo** | Cronômetro livre ou pomodoro que continua rodando com a aba fechada, lançamento manual e histórico |
| 👤 | **Perfil** | Foto e apelido, backup em JSON e dados de exemplo |
| 📱 | **PWA** | Instala no celular pela opção "Adicionar à Tela de Início" |

Tema claro/escuro automático, layout responsivo e interface em português.

Os dados ficam no próprio navegador (IndexedDB): não há servidor, conta nem login.

## 🚀 Como usar

### 1. Rodar local
Requer Node.js 22+.

```bash
npm ci
npm run dev
```
Abra http://localhost:5173/.

### 2. Build
```bash
npm run build
```
Os arquivos estáticos ficam em `dist/` e podem ser servidos por qualquer hospedagem de site estático.

## 🔒 Segurança

- **XSS**: nenhum HTML é injetado (React escapa todo texto); links só `http(s)` com `noopener noreferrer`; foto de
  perfil regravada em WebP e validada.
- **Entradas validadas** em todos os formulários e na importação de backup.
- **Dependências mínimas**: só `react` e `react-dom` em produção.

> ⚠️ Os dados existem só no navegador em que foram criados. Limpar os dados do site apaga tudo: exporte backups em
> **Perfil → Exportar backup**.

## 🎨 Personalizar

- **Cores**: tokens no topo de [`src/styles.css`](src/styles.css) (laranja, azul, verde, preto e branco).
- **Ícone**: [`public/favicon.svg`](public/favicon.svg) e os PNGs em `public/`.

## 📁 Estrutura

```
src/
  data/        armazenamento local, modelos, validação e regras de negócio
  pages/       telas
  components/  componentes visuais
public/        config, ícones, manifesto e service worker
```

## 📄 Licença

[MIT](LICENSE)
