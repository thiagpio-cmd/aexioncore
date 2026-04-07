# Aexion Core — Plano Estratégico de Verticalização

**Data:** 2026-04-07
**Autor:** CTO Office
**Classificação:** Estratégico — Documento de Decisão e Roadmap

---

## 1. DIAGNÓSTICO — Onde estamos

### O que existe hoje

| Dimensão | Estado |
|---|---|
| **Stack** | Next.js 15, React 19, Prisma/PostgreSQL, Tailwind v4, NextAuth |
| **Pages** | 22 dashboard pages funcionais |
| **API** | 60+ endpoints |
| **Models** | 45 modelos Prisma (core, pipeline, intelligence, integrations) |
| **AI** | 4 providers (OpenAI, Anthropic, Gemini, Rule Engine), AI Chat CCO |
| **Pipeline** | 6 stages imobiliários (Lead Inquiry → Closed Won) |
| **Integrações** | Gmail, Google Calendar, Outlook, Twilio, Slack, Zoom |
| **Deploy** | Vercel, PostgreSQL Supabase, auto-deploy on push |
| **MVP Score** | ~80% |

### O que existe de bom

1. **Pipeline stages já são de real estate** — Lead Inquiry, Property Tour, Offer Submitted, Under Contract, Due Diligence, Closed Won/Lost
2. **Infraestrutura de AI é extensível** — 4 providers plugáveis, activity processor, action executor, rule engine
3. **Schema é rico** — 45 modelos incluindo behavioral signals, deal scoring, ICP engine, debrief system
4. **Workspaces por persona** — SDR, Closer, Manager, Executive já existem
5. **Integração backbone** — credential vault, webhook security, provider registry

### O que NÃO existe (gaps críticos para verticalização)

1. **Zero integrações com dados de CRE** — Sem CoStar, LoopNet, Crexi, Reonomy
2. **Moeda hardcoded em BRL** — defaultCurrencyCode é "BRL", precisa ser USD
3. **Sem campos específicos de CRE** — Sem property type, sqft, cap rate, NOI, tenant info
4. **Sem document management** — Sem LOI, PSA, NDA templates integrados ao deal flow
5. **Sem commission tracking** — Sem split calculation, brokerage fees
6. **Sem comp analysis** — Sem base de comparables integrada
7. **AI é genérica** — CCO persona fala de real estate mas não tem dados de mercado reais
8. **Sem onboarding para CRE** — Setup wizard é genérico
9. **Sem billing/pricing** — Nenhuma infraestrutura de monetização
10. **Sem landing page / marketing** — Produto sem go-to-market

### Causa raiz

O produto foi construído como **CRM genérico B2B com ambição de plataforma**. A verticalização para CRE ficou na nomenclatura dos stages, mas não penetrou no modelo de dados, nas integrações, na inteligência de AI, nem no go-to-market.

---

## 2. DECISÃO ESTRATÉGICA

### Tese

**Parar de ser um CRM genérico com verniz imobiliário. Tornar-se o sistema operacional de receita para brokerages de Commercial Real Estate nos EUA.**

### O que muda

| De | Para |
|---|---|
| CRM genérico B2B | Revenue OS para CRE brokerages |
| Moeda BRL, termos BR | USD, termos do mercado americano |
| AI consultiva genérica | AI especialista em CRE com dados de mercado |
| Pipeline stages genéricos | Deal lifecycle completo de CRE |
| Sem integrações de indústria | CoStar/LoopNet/Crexi data feeds |
| Sem monetização | Pricing tiers com trial gratuito |
| Sem GTM | Landing page + beta program |

### O que NÃO muda

- Arquitetura técnica (Next.js, Prisma, Vercel)
- Workspace structure (SDR/Closer/Manager/Executive)
- AI infrastructure (providers, rule engine, chat)
- Core CRM models (Lead, Opportunity, Contact, Company, Account)
- Integration backbone (credential vault, provider registry)

---

## 3. ROADMAP — 4 Fases, 12 Semanas

```
FASE 1: CRE Foundation (Semanas 1-3)
  ↓
FASE 2: Intelligence Layer (Semanas 4-6)
  ↓
FASE 3: GTM + Monetização (Semanas 7-9)
  ↓
FASE 4: Beta Launch (Semanas 10-12)
```

---

### FASE 1 — CRE FOUNDATION (Semanas 1-3)

**Objetivo:** Tornar o modelo de dados, o pipeline e a experiência nativamente de CRE.

#### 1.1 — Schema CRE Expansion

**Prioridade:** Crítica
**Impacto:** Sem isso, nada funcional de CRE é possível.

```
Novos campos em Opportunity:
  propertyType      String?    // OFFICE, RETAIL, INDUSTRIAL, MULTIFAMILY, MIXED_USE, LAND, HOSPITALITY
  propertyAddress   String?
  propertySqft      Float?
  pricePerSqft      Float?
  capRate           Float?
  noi               Float?     // Net Operating Income
  occupancyRate     Float?
  yearBuilt         Int?
  zoning            String?
  dealType          String?    // SALE, LEASE, SUBLEASE, GROUND_LEASE, SALE_LEASEBACK
  leaseTermMonths   Int?
  askingRent        Float?     // per sqft/year
  tenantName        String?
  tenantIndustry    String?
  loiSubmittedAt    DateTime?
  dueDiligenceStart DateTime?
  dueDiligenceEnd   DateTime?
  closingDate       DateTime?

Novo modelo: Commission
  id                String
  opportunityId     String     → Opportunity
  agentId           String     → User
  role              String     // LISTING_AGENT, BUYERS_AGENT, REFERRAL
  splitPercent      Float
  grossAmount       Float
  netAmount         Float
  status            String     // PENDING, EARNED, PAID

Novo modelo: PropertyComp
  id                String
  organizationId    String
  address           String
  propertyType      String
  sqft              Float
  salePrice         Float?
  pricePerSqft      Float?
  capRate           Float?
  closedDate        DateTime?
  source            String?    // MANUAL, COSTAR, LOOPNET
  notes             String?

Novo modelo: Document
  id                String
  opportunityId     String?    → Opportunity
  accountId         String?    → Account
  type              String     // LOI, PSA, NDA, LEASE, AMENDMENT, CA, FINANCIAL_STATEMENT
  name              String
  fileUrl           String
  version           Int        @default(1)
  status            String     // DRAFT, SENT, SIGNED, EXPIRED
  sentAt            DateTime?
  signedAt          DateTime?
```

#### 1.2 — Currency & Locale Flip

**Prioridade:** Crítica
**Impacto:** Produto inteiro precisa operar em USD.

Tarefas:
- [ ] Organization.defaultCurrencyCode: "BRL" → "USD"
- [ ] Todas as formatações: R$ → $ (formatCurrency helpers)
- [ ] Locale de datas: pt-BR → en-US
- [ ] UI labels: português → inglês (todas as pages)
- [ ] AI system prompt: manter português para Thiago (CEO), mas produto em inglês
- [ ] Seed data: valores em USD, nomes de propriedades americanas, endereços US

#### 1.3 — Pipeline CRE Refinement

**Prioridade:** Alta
**Impacto:** Pipeline precisa refletir o deal lifecycle real de CRE.

Stages atualizados:
```
1. PROSPECTING        — Identificação de propriedade/oportunidade
2. INITIAL_CONTACT    — Primeiro contato com owner/broker
3. PROPERTY_TOUR      — Tour e due diligence inicial (já existe)
4. LOI_SUBMITTED      — Letter of Intent enviada
5. LOI_NEGOTIATION    — Negociação de termos
6. UNDER_CONTRACT     — PSA assinado (já existe)
7. DUE_DILIGENCE      — Due diligence formal (já existe)
8. FINANCING          — Aprovação de financiamento/equity
9. CLOSING            — Closing em andamento
10. CLOSED_WON        — Deal fechado (já existe)
11. CLOSED_LOST       — Deal perdido (já existe)
```

Kanban cards mostram:
- Property type icon
- Address (one-liner)
- Value + $/sqft
- Cap rate badge
- Days in stage + rotting indicator (já existe)
- Document status (LOI sent, PSA pending, etc.)

#### 1.4 — CRE Seed Data

**Prioridade:** Alta
**Impacto:** Demo precisa ser convincente com dados reais de CRE.

Dados de seed:
- 3 users: Broker (Closer), SDR (Junior Agent), Manager (Managing Director)
- 8-12 opportunities: mix de Office, Retail, Industrial, Multifamily
- Propriedades em mercados reais (Austin TX, Miami FL, Nashville TN, Phoenix AZ)
- Valores realistas: $2M-$50M range
- Cap rates: 5-8% range
- Comps database com 10-15 propriedades
- Documents: LOIs, PSAs em diferentes status
- Commissions: splits de 50/50, 60/40, referral fees

---

### FASE 2 — INTELLIGENCE LAYER (Semanas 4-6)

**Objetivo:** AI que entende CRE profundamente. Não um chatbot — uma consultora de deals imobiliários.

#### 2.1 — AI CRE Brain

**Prioridade:** Crítica (diferencial competitivo principal)
**Impacto:** É o que faz Aexion Core ser mais que um CRM com campos customizados.

Expandir o rule-based engine e o system prompt para incluir:

**Análise de deal:**
- "Cap rate de 4.8% neste mercado está abaixo da média (5.5%). Risco de sobrevalorização."
- "Ocupancy de 72% — abaixo do threshold de 85%. Negociar desconto de 10-15% no asking price."
- "Due diligence fecha em 12 dias. 3 tasks pendentes: environmental report, title search, survey."
- "Este deal está em LOI Negotiation há 18 dias. Média do mercado: 10 dias. Escalar."

**Comp analysis automático:**
- Quando um deal entra em stage LOI_SUBMITTED, AI puxa comps da base
- "3 propriedades similares (Office, 15K-25K sqft, Austin) fecharam nos últimos 6 meses a $285-$310/sqft. Seu deal está a $340/sqft — 10-19% acima do mercado."
- Calcula price/sqft, cap rate spread, NOI multiple vs comps

**Commission tracking:**
- "Se este deal fechar em $12.5M com split 60/40, sua comissão bruta será $375K (3%), líquido estimado $225K."
- "Pipeline de comissões: $485K earned pending, $1.2M in negotiation."

**Market intelligence (com dados internos):**
- "Seus deals de Industrial têm win rate de 67%, vs Office com 34%. Considerar realocar esforço."
- "Tempo médio de closing: Industrial 45 dias, Office 78 dias. Industrial 1.7x mais eficiente."
- "Q2 pipeline: 65% Office, 20% Industrial, 15% Retail. Concentração em Office é risco."

#### 2.2 — Deal Scoring CRE-Specific

**Prioridade:** Alta
**Impacto:** Health score genérico → score baseado em fundamentals de CRE.

Fórmula de Deal Score (0-100):
```
Base Score:
  +20 se cap rate >= mercado médio
  +15 se occupancy >= 85%
  +15 se price/sqft <= median comps
  +10 se LOI submitted < 14 dias atrás
  +10 se due diligence < 30 dias
  +10 se financing secured
  +10 se champion identificado no account
  +10 se < 3 objections registradas

Penalidades:
  -15 se days in stage > 2x média
  -10 se sem atividade > 14 dias
  -10 se environmental issues flagged
  -10 se title issues flagged
  -5 por cada task overdue relacionada
```

#### 2.3 — Document Intelligence

**Prioridade:** Média (fase 2 pode ser templates, AI fill vem depois)
**Impacto:** Diferencial forte — CRMs genéricos não têm document management de CRE.

- LOI template builder (preenchido com dados do deal)
- PSA checklist (standard due diligence items)
- NDA template com campos auto-populated
- Document timeline: quem enviou, quem assinou, quando
- AI review: "LOI está sem cláusula de financing contingency. Recomendação: adicionar 60-day contingency."

#### 2.4 — Proactive Insights por Page

**Prioridade:** Alta
**Impacto:** AI presente em todo o app com contexto CRE real.

Expandir o AIInsightBanner (já existe) com prompts CRE-specific:
- **Dashboard:** "Portfolio summary: X deals, $Xm pipeline, projected commissions $X"
- **Pipeline:** "2 deals approaching DD deadline. 1 LOI expiring in 5 days."
- **Opportunity detail:** "This property's cap rate (5.2%) is 30bps below market. Comp analysis shows..."
- **Forecast:** "Based on stage probability and historical close rates, Q2 commission forecast: $X"
- **Tasks:** "3 DD items overdue on $12M deal. Environmental report is blocking closing."

---

### FASE 3 — GTM + MONETIZAÇÃO (Semanas 7-9)

**Objetivo:** Tornar o produto comercializável. Não lançar no escuro.

#### 3.1 — Landing Page

**Prioridade:** Crítica para GTM
**Impacto:** Sem isso, não existe captação de beta users.

Página em `/` (public, fora do auth):
- Hero: "The Revenue OS Built for Commercial Real Estate"
- Subline: "Stop losing deals in spreadsheets. Track, analyze, and close commercial properties with AI-powered intelligence."
- 4 value props com icons:
  1. "Pipeline built for CRE deals" (stages, property data, comps)
  2. "AI that speaks real estate" (cap rate analysis, comp analysis, commission tracking)
  3. "Documents that close deals" (LOI, PSA, NDA integrated in deal flow)
  4. "Commission clarity" (splits, projections, earned vs pending)
- Screenshot do dashboard com dados CRE reais
- Pricing section (ver 3.2)
- CTA: "Start Free Trial" → /register
- Footer: "Built by operators, for operators."

**Tech:** Static page, SEO otimizado, sem auth required.

#### 3.2 — Pricing Model

**Prioridade:** Alta
**Impacto:** Define viabilidade comercial.

```
STARTER — $49/user/month (annual) | $59/month (monthly)
  - Pipeline + CRM básico
  - 5 users max
  - AI chat (rule-based only)
  - 500 comps database
  - Basic reports

PROFESSIONAL — $89/user/month (annual) | $109/month (monthly)
  - Tudo do Starter +
  - AI with OpenAI (full CCO persona)
  - Unlimited comps
  - Document management (LOI, PSA, NDA)
  - Commission tracking
  - Advanced analytics
  - Manager workspace

ENTERPRISE — Custom pricing
  - Tudo do Professional +
  - White-label branding
  - API access
  - Custom integrations (CoStar, MLS)
  - Executive workspace
  - SSO/SAML
  - Dedicated support
```

**Implementação:**
- Stripe integration para billing
- Modelo Organization ganha campo `plan: STARTER | PROFESSIONAL | ENTERPRISE`
- Feature gates no middleware por plan
- Free trial: 14 dias de Professional

#### 3.3 — Onboarding CRE

**Prioridade:** Alta
**Impacto:** First 5 minutes decidem se o broker continua.

Setup wizard (4 steps):
1. **Company** — Brokerage name, address, license number
2. **Markets** — Select primary markets (MSAs) the brokerage operates in
3. **Team** — Invite 1-3 agents, assign roles
4. **First Deal** — Import or create one deal with property data

AI greeting após onboarding:
"Welcome to Aexion Core. I've set up your brokerage profile. You have 1 active deal — [Property Name] at [Address]. Want me to analyze the deal and suggest next steps?"

---

### FASE 4 — BETA LAUNCH (Semanas 10-12)

**Objetivo:** 10 brokerages usando o produto. Feedback real.

#### 4.1 — Beta Program

**Prioridade:** Crítica
**Impacto:** Validação de mercado antes de investir mais.

- Target: 10 brokerages de CRE nos EUA (5-50 agents cada)
- Markets: Austin, Miami, Nashville, Phoenix, Dallas (mercados quentes de CRE)
- Incentivo: 3 meses grátis de Professional plan
- Requirement: weekly 15-min feedback call
- Tracking: NPS, feature usage, deal velocity, churn indicators

Canais de aquisição:
1. LinkedIn outreach direto para Managing Directors de CRE brokerages
2. CCIM, SIOR, NAIOP member directories
3. CRE subreddits e forums (BiggerPockets commercial section)
4. Cold email com case study do próprio Thiago usando a ferramenta

#### 4.2 — Integration Roadmap (Post-Beta)

Priorizado por feedback de beta users:

| Integração | Valor | Complexidade | Timing |
|---|---|---|---|
| **CoStar API** | Comp data automática | Alta (API cara, $$$) | Q3 2026 |
| **LoopNet** | Listing data sync | Média | Q3 2026 |
| **Crexi** | Deal marketing integration | Média | Q3 2026 |
| **DocuSign** | E-signature no deal flow | Baixa | Q2 2026 (pode antecipar) |
| **Google Workspace** | Gmail + Calendar (já existe) | Já implementado | ✅ |
| **QuickBooks** | Commission accounting | Média | Q4 2026 |
| **Reonomy** | Property ownership data | Alta | Q4 2026 |

#### 4.3 — Metrics de Sucesso

| Métrica | Target 90 dias |
|---|---|
| Beta brokerages ativas | 10 |
| Agents ativos (DAU) | 30+ |
| Deals tracked | 100+ |
| NPS | > 40 |
| Feature requests categorizados | 50+ |
| Churn no beta | < 20% |
| Primeiro pagante | 1 brokerage convertida |

---

## 4. TRADE-OFFS ACEITOS

### O que ganhamos
- Posicionamento vertical claro contra Salesforce
- AI diferenciada com conhecimento de CRE
- Pricing acessível para mid-market
- Speed-to-market (12 semanas para beta)
- Defensibilidade: dados de CRE + workflows especializados = switching cost alto

### O que perdemos
- Mercado genérico B2B (era ilusão de qualquer forma)
- Revenue de clientes não-CRE (não existiam ainda)
- Simplicidade de manutenção (mais campos, mais regras, mais dados)

### O que adiamos deliberadamente
- Integrações com CoStar/LoopNet (caras, dependem de validação)
- Mobile app nativo (web responsivo é suficiente para beta)
- Advanced analytics (BI-level dashboards)
- Multi-language (inglês first, português para admin)
- Marketplace de integrações
- AI com dados de mercado real-time (começa com dados internos + comps manuais)

---

## 5. RISCOS DO PLANO

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| CoStar API é cara demais | Alta | Médio | Começar com comps manuais + scraping permitido |
| Brokerages não adotam | Média | Crítico | Beta com incentivo forte + feedback semanal |
| Salesforce lança vertical CRE | Baixa | Alto | Mover rápido, nichar mais (ex: só Investment Sales) |
| Complexidade do schema cresce demais | Média | Médio | Manter campos CRE como optional, não breaking |
| AI não é "smart" o suficiente sem dados de mercado | Alta | Alto | Rule-based com benchmarks hardcoded por market |
| Desenvolvedor solo (Thiago) vira bottleneck | Alta | Crítico | Contratar 1 dev após validação beta |

---

## 6. PRÓXIMOS PASSOS IMEDIATOS (Esta Semana)

### Dia 1-2: Schema + Currency
- [ ] Adicionar campos CRE ao model Opportunity no Prisma
- [ ] Criar models Commission, PropertyComp, Document
- [ ] Flip defaultCurrencyCode para USD
- [ ] Atualizar seed data com propriedades US reais
- [ ] Atualizar formatCurrency para USD

### Dia 3-4: Pipeline + UI
- [ ] Expandir STAGES para 11 stages de CRE
- [ ] Atualizar Kanban cards com property info
- [ ] Criar/atualizar modal de Opportunity com campos CRE
- [ ] Atualizar opportunity detail page com property data

### Dia 5-7: AI + Seed
- [ ] Atualizar AI system prompt com CRE knowledge
- [ ] Adicionar rule-based handlers para cap rate, comps, commission
- [ ] Atualizar AIInsightBanner prompts para CRE
- [ ] Full seed data com 12 deals, comps, commissions
- [ ] Test end-to-end: create deal → track → AI analysis

---

## 7. DEFINIÇÃO DE DONE — Vertical CRE Pronto

O produto está "verticalizado" quando:

- [ ] Um broker de CRE consegue criar um deal com todos os campos de propriedade
- [ ] O pipeline mostra property type, $/sqft, cap rate em cada card
- [ ] A AI analisa um deal com métricas de CRE (não genéricas)
- [ ] O commission tracker mostra split e projeção por deal
- [ ] O comp database aceita inserção manual e mostra análise comparativa
- [ ] O seed data conta uma história convincente de brokerage real
- [ ] A landing page comunica claramente "CRE Revenue OS"
- [ ] O pricing está definido e o Stripe aceita pagamento
- [ ] 1 broker real (que não seja o Thiago) conseguiu completar o onboarding sozinho

---

*"Não tente ser o CRM de todos. Seja o sistema que nenhum broker de CRE consegue largar."*
