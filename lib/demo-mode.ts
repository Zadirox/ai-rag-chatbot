import { chunkText } from "./document-parser";
import type { DocumentRecord } from "./vector-store";

const DEMO_DOC_TEXT = `Annual Report 2025 — Zadirox Technologies

Executive Summary
Zadirox Technologies achieved record revenue of $2.84 million in fiscal year 2025, representing a 34% increase from the previous year. The company expanded into three new markets: Kazakhstan, Uzbekistan, and Georgia. Employee count grew from 45 to 78, with the engineering team doubling in size.

Financial Highlights
- Total Revenue: $2,840,000 (+34% YoY)
- Operating Expenses: $1,920,000 (+22% YoY)  
- Net Profit: $920,000 (+58% YoY)
- Profit Margin: 32.4% (up from 27.1%)

The largest revenue segment was SaaS subscriptions at $1.68M, followed by consulting services at $780K, and custom development at $380K. Recurring revenue now accounts for 59% of total revenue, up from 42% in 2024.

Product Development
In 2025, we launched SmartBot, an AI-powered document assistant that uses RAG technology to provide cited answers from uploaded documents. The product achieved 2,400 active users within 6 months of launch, with a 72% retention rate after 30 days.

We also released Dashboard Pro 2.0, featuring real-time analytics, multi-currency support (USD, EUR, KZT, RUB), and a bilingual interface (English/Russian). Enterprise adoption grew 180% following the update.

Team and Culture
The engineering team expanded from 18 to 36 engineers. We hired specialists in AI/ML, cybersecurity, and DevOps. The employee satisfaction score reached 4.2/5.0, and turnover decreased to 8% from 15% in the prior year.

Remote work policy was formalized, allowing team members to work from anywhere in the CIS region. Monthly team meetups were established in Almaty, Tashkent, and Tbilisi.

Market Expansion
Kazakhstan became our second-largest market with $620K in revenue. Key partnerships were established with Kaspi Bank and KazakhTelecom. The Uzbekistan market generated $280K, with strong demand for our AI chatbot solutions.

Outlook for 2026
We project revenue of $4.2M, driven by expansion into Azerbaijan and Kyrgyzstan. SmartBot 2.0 with multi-document Q&A is scheduled for Q2. Hiring target is 120 employees by year-end, with particular focus on sales and customer success roles.`;

const DEMO_ANSWERS: Record<string, string> = {
  revenue: `Based on the document [Source 1], **Zadirox Technologies** achieved total revenue of **$2,840,000** in fiscal year 2025, a **34% increase** year-over-year.\n\nRevenue breakdown:\n- SaaS subscriptions: $1.68M (59% of total)\n- Consulting services: $780K\n- Custom development: $380K\n\nThe profit margin improved from 27.1% to **32.4%**.`,
  team: `According to the report [Source 1], the team grew significantly:\n\n- **Total employees**: 78 (up from 45)\n- **Engineering team**: doubled from 18 to 36 engineers\n- New specialists in AI/ML, cybersecurity, and DevOps\n- **Employee satisfaction**: 4.2/5.0\n- **Turnover**: decreased to 8% (from 15%)\n\nA formal remote work policy was established for the CIS region.`,
  product: `The document highlights two major products [Source 1]:\n\n**SmartBot** — AI document assistant using RAG:\n- 2,400 active users in 6 months\n- 72% retention rate after 30 days\n\n**Dashboard Pro 2.0**:\n- Real-time analytics\n- Multi-currency (USD, EUR, KZT, RUB)\n- Bilingual interface (EN/RU)\n- Enterprise adoption grew **180%**`,
  plan: `The 2026 outlook [Source 1] includes:\n\n- Projected revenue: **$4.2M**\n- Expansion into **Azerbaijan** and **Kyrgyzstan**\n- **SmartBot 2.0** with multi-document Q&A in Q2\n- Hiring target: **120 employees** by year-end\n- Focus on sales and customer success roles`,
};

function matchDemoAnswer(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("revenue") || q.includes("profit") || q.includes("financial") || q.includes("доход") || q.includes("прибыл") || q.includes("финанс")) return DEMO_ANSWERS.revenue;
  if (q.includes("team") || q.includes("employee") || q.includes("hire") || q.includes("команд") || q.includes("сотрудник") || q.includes("найм")) return DEMO_ANSWERS.team;
  if (q.includes("product") || q.includes("docubot") || q.includes("dashboard") || q.includes("продукт") || q.includes("дашборд")) return DEMO_ANSWERS.product;
  if (q.includes("2026") || q.includes("outlook") || q.includes("plan") || q.includes("future") || q.includes("план") || q.includes("будущ") || q.includes("перспектив")) return DEMO_ANSWERS.plan;
  return `Based on the Annual Report 2025 [Source 1], Zadirox Technologies had a strong year with **$2.84M revenue** (+34% YoY) and **$920K net profit** (+58% YoY). The company expanded into Kazakhstan, Uzbekistan, and Georgia, and launched SmartBot which reached 2,400 active users.\n\nTry asking about **revenue**, **team**, **products**, or **2026 plans** for more details.`;
}

export function createDemoDocument(): DocumentRecord {
  const chunks = chunkText(DEMO_DOC_TEXT);
  const fakeEmbeddings = chunks.map(() => Array(8).fill(0));

  return {
    id: "demo-doc-1",
    name: "Annual Report 2025.pdf",
    type: "pdf",
    size: 245000,
    chunkCount: chunks.length,
    uploadedAt: new Date().toISOString(),
    summary: "Zadirox Technologies achieved $2.84M revenue in 2025 (+34% YoY) with $920K net profit. Key products: SmartBot (2,400 users) and Dashboard Pro 2.0. Expanded to Kazakhstan, Uzbekistan, Georgia.",
    keyTerms: ["Revenue", "SmartBot", "Dashboard Pro", "Expansion", "RAG", "SaaS", "Engineering"],
    chunks: chunks.map((text, i) => ({
      id: `demo-chunk-${i}`,
      docId: "demo-doc-1",
      docName: "Annual Report 2025.pdf",
      text,
      embedding: fakeEmbeddings[i],
      chunkIndex: i,
    })),
  };
}

export function getDemoStreamResponse(question: string): ReadableStream<Uint8Array> {
  const answer = matchDemoAnswer(question);
  const sources = JSON.stringify({
    sources: [
      { docName: "Annual Report 2025.pdf", chunkIndex: 0, text: DEMO_DOC_TEXT.slice(0, 300) },
      { docName: "Annual Report 2025.pdf", chunkIndex: 1, text: DEMO_DOC_TEXT.slice(300, 600) },
    ],
  });

  const fullContent = answer + `\n__SOURCES__${sources}`;
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const words = fullContent.split(" ");
      for (let i = 0; i < words.length; i++) {
        const chunk = i === 0 ? words[i] : " " + words[i];
        controller.enqueue(encoder.encode(chunk));
        await new Promise((r) => setTimeout(r, 30));
      }
      controller.close();
    },
  });
}
