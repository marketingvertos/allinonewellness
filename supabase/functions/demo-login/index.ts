import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_EMAIL = "demo@vertos.in";
const DEMO_PASSWORD = "DemoVertos@2026";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
const istDate = (d: number) => new Date(Date.now() + d * 86400000 + IST_OFFSET_MS).toISOString().slice(0, 10);

const COMPANIES = [
  { name: "Tata Digital Pvt. Ltd.", website: "https://tatadigital.com", industry: "Retail Tech — Mumbai" },
  { name: "Infosys BPM", website: "https://infosysbpm.com", industry: "IT Services — Bengaluru" },
  { name: "Zerodha Broking", website: "https://zerodha.com", industry: "Fintech — Bengaluru" },
  { name: "Nykaa Retail", website: "https://nykaa.com", industry: "E-commerce — Mumbai" },
  { name: "Reliance Jio Platforms", website: "https://jio.com", industry: "Telecom — Navi Mumbai" },
  { name: "Swiggy (Bundl Technologies)", website: "https://swiggy.com", industry: "Food Delivery — Bengaluru" },
  { name: "Paytm (One97 Communications)", website: "https://paytm.com", industry: "Payments — Noida" },
  { name: "Mahindra Logistics", website: "https://mahindralogistics.com", industry: "Logistics — Pune" },
  { name: "Asian Paints Ltd.", website: "https://asianpaints.com", industry: "Manufacturing — Mumbai" },
  { name: "Apollo Hospitals", website: "https://apollohospitals.com", industry: "Healthcare — Chennai" },
];

const CONTACTS = [
  ["Ananya", "Sharma", "VP Sales", 0, "ananya.sharma", ["decision-maker", "enterprise"]],
  ["Rohit", "Verma", "Head of Marketing", 0, "rohit.verma", ["champion"]],
  ["Priya", "Iyer", "Delivery Director", 1, "priya.iyer", ["enterprise"]],
  ["Karthik", "Subramanian", "CTO", 2, "karthik.s", ["technical", "champion"]],
  ["Neha", "Gupta", "Growth Manager", 3, "neha.gupta", ["marketing"]],
  ["Arjun", "Mehta", "Product Head", 4, "arjun.mehta", ["decision-maker"]],
  ["Sneha", "Reddy", "Category Lead", 5, "sneha.reddy", ["retail"]],
  ["Vikram", "Singh", "Regional Sales Manager", 6, "vikram.singh", ["north-india"]],
  ["Divya", "Nair", "CRM Lead", 7, "divya.nair", ["technical"]],
  ["Aditya", "Joshi", "Plant Operations Head", 8, "aditya.joshi", ["manufacturing"]],
  ["Meera", "Krishnan", "Chief Digital Officer", 9, "meera.krishnan", ["decision-maker", "enterprise"]],
  ["Rahul", "Deshmukh", "Procurement Manager", 8, "rahul.deshmukh", ["procurement"]],
  ["Ishita", "Banerjee", "Customer Success Head", 3, "ishita.banerjee", ["champion"]],
  ["Sandeep", "Rao", "Finance Controller", 5, "sandeep.rao", ["finance"]],
  ["Pooja", "Malhotra", "Brand Manager", 6, "pooja.malhotra", ["marketing"]],
] as const;

const DEAL_ROWS = [
  { title: "Annual CRM Licence — Tata Digital", c: 0, ct: 0, value: 8500000, prob: 80, stage: 3, close: 20, notes: "Procurement review pending; GST invoice required." },
  { title: "Marketing Automation Rollout — Infosys BPM", c: 1, ct: 2, value: 6200000, prob: 60, stage: 2, close: 35, notes: "Pilot for Bengaluru delivery centre." },
  { title: "Zerodha Investor Outreach Suite", c: 2, ct: 3, value: 1850000, prob: 45, stage: 1, close: 45, notes: "Technical evaluation with CTO team." },
  { title: "Nykaa Festive Campaign Platform", c: 3, ct: 4, value: 3400000, prob: 70, stage: 3, close: 15, notes: "Diwali campaign timeline is critical." },
  { title: "Jio Platforms Enterprise Deployment", c: 4, ct: 5, value: 12500000, prob: 40, stage: 1, close: 70, notes: "Multi-circle rollout; needs security review." },
  { title: "Swiggy Partner Onboarding CRM", c: 5, ct: 6, value: 2750000, prob: 55, stage: 2, close: 30, notes: "Focus on restaurant partner lifecycle." },
  { title: "Paytm Merchant Success Module", c: 6, ct: 7, value: 4100000, prob: 65, stage: 2, close: 40, notes: "Integration with existing merchant panel." },
  { title: "Mahindra Logistics Fleet Sales Tracker", c: 7, ct: 8, value: 1950000, prob: 50, stage: 1, close: 55, notes: "Pune HQ pilot for 40 users." },
  { title: "Asian Paints Dealer Network CRM", c: 8, ct: 9, value: 7300000, prob: 75, stage: 3, close: 25, notes: "Dealer network of 5,000+ across India." },
  { title: "Apollo Hospitals Patient CRM", c: 9, ct: 10, value: 5600000, prob: 35, stage: 1, close: 80, notes: "Compliance sign-off required." },
  { title: "Tata Digital Loyalty Add-on", c: 0, ct: 1, value: 1500000, prob: 90, stage: 4, close: -5, notes: "Closed won — PO received." },
  { title: "Infosys BPM Analytics Upgrade", c: 1, ct: 2, value: 2200000, prob: 100, stage: 4, close: -12, notes: "Closed won in Q1." },
  { title: "Nykaa Influencer CRM", c: 3, ct: 12, value: 900000, prob: 0, stage: 5, close: -20, notes: "Lost to in-house build." },
  { title: "Swiggy Instamart Vendor Portal", c: 5, ct: 13, value: 1250000, prob: 20, stage: 0, close: 90, notes: "Early discovery call done." },
  { title: "Paytm Insider Events Pipeline", c: 6, ct: 14, value: 1750000, prob: 25, stage: 0, close: 75, notes: "Referred by marketing team." },
  { title: "Reliance Retail Store Sales App", c: 4, ct: 5, value: 9800000, prob: 30, stage: 0, close: 100, notes: "Large opportunity, long cycle." },
  { title: "Zerodha Varsity Lead Capture", c: 2, ct: 3, value: 650000, prob: 60, stage: 2, close: 28, notes: "Small but quick-to-close deal." },
  { title: "Mahindra Dealer Renewal FY27", c: 7, ct: 11, value: 3100000, prob: 85, stage: 3, close: 10, notes: "Renewal with 12% uplift." },
  { title: "Apollo Diagnostics Outbound Suite", c: 9, ct: 10, value: 2400000, prob: 45, stage: 1, close: 60, notes: "Chennai and Hyderabad centres." },
  { title: "Asian Paints Beautiful Homes CRM", c: 8, ct: 9, value: 4650000, prob: 55, stage: 2, close: 50, notes: "Awaiting design workshop." },
];

const TASKS = [
  ["Call Ananya Sharma about GST invoicing", "high", 1],
  ["Send revised proposal to Infosys BPM", "high", 2],
  ["Prepare demo for Zerodha tech team", "medium", 3],
  ["Follow up on Nykaa festive timeline", "high", 1],
  ["Share security whitepaper with Jio Platforms", "medium", 5],
  ["Schedule Swiggy partner workshop in Bengaluru", "medium", 6],
  ["Review Paytm integration scope", "low", 8],
  ["Site visit — Mahindra Logistics, Pune", "medium", 9],
  ["Draft dealer network rollout plan for Asian Paints", "high", 4],
  ["Compliance checklist for Apollo Hospitals", "low", 12],
  ["Send Diwali greetings to top 20 accounts", "low", 14],
  ["Quarterly business review deck (IST 11:00 AM)", "medium", 7],
  ["Update forecast for Q3 FY27", "high", 2],
  ["Reconnect with Pooja Malhotra at Paytm", "low", 11],
  ["Collect PO copy from Tata Digital", "high", -1],
] as const;

const ACTIVITY_TYPES = ["call", "email", "meeting", "note"] as const;

async function seed(userId: string) {
  const { count } = await admin.from("companies").select("id", { count: "exact", head: true }).eq("created_by", userId);
  if ((count ?? 0) > 0) return;

  const { data: pipeline } = await admin
    .from("pipelines")
    .insert({ name: "India Sales Pipeline", created_by: userId })
    .select("id")
    .single();
  if (!pipeline) throw new Error("pipeline insert failed");

  const stageNames = [
    ["Prospect", "#3b82f6"],
    ["Qualified", "#8b5cf6"],
    ["Proposal", "#f97316"],
    ["Negotiation", "#eab308"],
    ["Won", "#22c55e"],
    ["Lost", "#ef4444"],
  ];
  const { data: stages } = await admin
    .from("pipeline_stages")
    .insert(stageNames.map(([name, color], i) => ({ pipeline_id: pipeline.id, name, color, position: i })))
    .select("id, position");
  const stageId = (pos: number) => stages!.find((s) => s.position === pos)!.id;

  const { data: companies } = await admin
    .from("companies")
    .insert(COMPANIES.map((c) => ({ ...c, created_by: userId })))
    .select("id");

  const domainOf = (i: number) => new URL(COMPANIES[i].website).hostname.replace("www.", "");
  const { data: contacts } = await admin
    .from("contacts")
    .insert(
      CONTACTS.map(([first, last, position, cIdx, handle, tags]) => ({
        first_name: first,
        last_name: last,
        position,
        email: `${handle}@${domainOf(cIdx as number)}`,
        phone: `+91 9${Math.floor(100000000 + Math.random() * 899999999)}`,
        company_id: companies![cIdx as number].id,
        tags: tags as unknown as string[],
        created_by: userId,
      })),
    )
    .select("id");

  const { data: deals } = await admin
    .from("deals")
    .insert(
      DEAL_ROWS.map((d) => ({
        title: d.title,
        company_id: companies![d.c].id,
        contact_id: contacts![d.ct].id,
        pipeline_id: pipeline.id,
        stage_id: stageId(d.stage),
        owner_id: userId,
        created_by: userId,
        value: d.value,
        probability: d.prob,
        close_date: istDate(d.close),
        notes: d.notes,
      })),
    )
    .select("id");

  await admin.from("tasks").insert(
    TASKS.map(([title, priority, due], i) => ({
      user_id: userId,
      title,
      priority,
      due_date: daysFromNow(due as number),
      completed: (due as number) < 0,
      deal_id: deals![i % deals!.length].id,
    })),
  );

  const activityTitles = [
    "Intro call with the buying team",
    "Sent pricing in INR with GST breakup",
    "Product demo over Google Meet",
    "Shared case study of an Indian client",
    "Follow-up on procurement timeline",
    "On-site meeting at client office",
    "Negotiated annual contract value",
    "Discussed rollout across regional offices",
    "Sent MSA draft for legal review",
    "Quarterly check-in call",
  ];
  await admin.from("activities").insert(
    Array.from({ length: 25 }, (_, i) => ({
      user_id: userId,
      deal_id: deals![i % deals!.length].id,
      contact_id: contacts![i % contacts!.length].id,
      type: ACTIVITY_TYPES[i % 4],
      title: activityTitles[i % activityTitles.length],
      description: "Logged from the field team (IST).",
      created_at: daysFromNow(-(i + 1)),
    })),
  );

  await admin.from("email_templates").insert([
    {
      user_id: userId,
      name: "Intro — India Enterprise",
      subject: "Helping {{company}} close more deals across India",
      body: "Namaste {{first_name}},\n\nI work with sales teams at Indian enterprises to streamline their pipeline. Would you be open to a 20-minute call this week (IST)?\n\nBest regards,\nSales Team, Vertos Marketing Pvt. Ltd.",
    },
    {
      user_id: userId,
      name: "Proposal Follow-up (INR)",
      subject: "Proposal for {{company}} — pricing in INR",
      body: "Hi {{first_name}},\n\nSharing the revised proposal with pricing in INR (GST extra as applicable). Happy to walk your team through it at a convenient IST slot.\n\nRegards,\nVertos Marketing",
    },
  ]);

  await admin.from("notifications").insert([
    { user_id: userId, type: "deal_created", title: "Deal moved to Negotiation", message: "Asian Paints Dealer Network CRM is now in Negotiation." },
    { user_id: userId, type: "task_due", title: "Task due today", message: "Collect PO copy from Tata Digital." },
  ]);
}

const WELLNESS_MEMBERS = [
  ["Ananya Iyer", "female", "weight_loss", 78.4, 72.5, 65],
  ["Rohit Deshmukh", "male", "fat_loss", 92.0, 87.2, 80],
  ["Meera Nair", "female", "weight_management", 61.2, 60.4, 58],
  ["Vikram Chauhan", "male", "body_transformation", 104.5, 96.8, 85],
  ["Sneha Kulkarni", "female", "weight_loss", 71.0, 66.3, 60],
  ["Arjun Menon", "male", "general_wellness", 74.8, 74.0, 72],
  ["Divya Raghavan", "female", "healthy_lifestyle", 66.5, 64.9, 62],
  ["Karthik Subramanian", "male", "weight_loss", 88.9, 83.1, 78],
  ["Pooja Bhatt", "female", "fat_loss", 69.7, 65.2, 60],
  ["Sandeep Rathore", "male", "weight_gain", 54.3, 58.1, 65],
  ["Lakshmi Venkatesh", "female", "weight_loss", 82.0, 77.4, 68],
  ["Imran Sheikh", "male", "weight_management", 79.5, 78.2, 75],
  ["Nisha Agarwal", "female", "healthy_lifestyle", 63.8, 62.5, 60],
  ["Harpreet Kaur", "female", "weight_loss", 85.6, 79.9, 70],
  ["Manish Gupta", "male", "fat_loss", 97.2, 91.5, 82],
] as const;

const isoDate = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

async function seedWellness(userId: string) {
  const { count } = await admin
    .from("wellness_members")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId);
  if ((count ?? 0) > 0) return;

  const { data: plans } = await admin
    .from("wellness_plans")
    .insert([
      { name: "3-Day Trial", plan_type: "trial", duration_days: 3, total_servings: 3, price: 0, description: "Complimentary introductory trial.", created_by: userId },
      { name: "Starter — 12 Servings", plan_type: "membership", duration_days: 30, total_servings: 12, price: 2400, description: "Alternate-day plan for beginners.", created_by: userId },
      { name: "Balance — 30 Servings", plan_type: "membership", duration_days: 30, total_servings: 30, price: 5500, description: "Daily serving for a full month.", created_by: userId },
      { name: "Transform — 90 Servings", plan_type: "membership", duration_days: 90, total_servings: 90, price: 14500, description: "Quarterly transformation programme.", created_by: userId },
    ])
    .select("id, name, total_servings, duration_days, price");
  if (!plans) throw new Error("plan insert failed");

  const planByName = (name: string) => plans.find((p) => p.name.startsWith(name))!;

  const { data: batches } = await admin
    .from("wellness_batches")
    .insert([
      { name: "Morning Batch (6:30 AM IST)", program_type: "weight_loss", start_date: isoDate(-40), coach_staff_id: userId, max_capacity: 25, created_by: userId },
      { name: "Evening Batch (7:00 PM IST)", program_type: "general_wellness", start_date: isoDate(-25), coach_staff_id: userId, max_capacity: 25, created_by: userId },
    ])
    .select("id");

  const statuses = ["active_member", "active_member", "active_member", "active_member", "active_member", "active_member", "renewal_due", "renewal_due", "trial", "trial", "lead", "lead", "expired", "active_member", "active_member"];

  const { data: members } = await admin
    .from("wellness_members")
    .insert(
      WELLNESS_MEMBERS.map(([name, gender, goal, initial, current, target], i) => ({
        full_name: name,
        mobile_number: `+91 9${String(800000000 + i * 1234567).slice(0, 9)}`,
        email: `${name.split(" ")[0].toLowerCase()}@example.in`,
        gender,
        goal,
        initial_weight: initial,
        current_weight: current,
        target_weight: target,
        height: gender === "female" ? 158 + (i % 8) : 170 + (i % 9),
        joining_date: isoDate(-(60 - i * 3)),
        status: statuses[i],
        batch_id: batches?.[i % 2]?.id ?? null,
        created_by: userId,
      })),
    )
    .select("id, full_name, status, current_weight, initial_weight");
  if (!members) throw new Error("member insert failed");

  // Trials for the trial-stage members
  const trialMembers = members.filter((m) => m.status === "trial");
  if (trialMembers.length) {
    await admin.from("wellness_trials").insert(
      trialMembers.map((m, i) => ({
        member_id: m.id,
        plan_id: planByName("3-Day").id,
        start_date: isoDate(-i),
        duration_days: 3,
        weight_at_start: m.current_weight,
        status: "active",
        created_by: userId,
      })),
    );
  }

  // Memberships for active / renewal-due members
  const paidMembers = members.filter((m) => m.status === "active_member" || m.status === "renewal_due");
  const membershipRows = paidMembers.map((m, i) => {
    const plan = i % 3 === 0 ? planByName("Transform") : i % 2 === 0 ? planByName("Balance") : planByName("Starter");
    const used = Math.min(plan.total_servings - (m.status === "renewal_due" ? 2 : 6 + (i % 8)), plan.total_servings);
    const safeUsed = Math.max(used, 0);
    return {
      member_id: m.id,
      plan_id: plan.id,
      membership_code: `WM-2026-${String(100200 + i)}`,
      start_date: isoDate(-(20 + i)),
      end_date: isoDate(plan.duration_days - 20 - i),
      total_servings: plan.total_servings,
      used_servings: safeUsed,
      remaining_servings: plan.total_servings - safeUsed,
      status: m.status === "renewal_due" ? "expiring_soon" : "active",
      price_paid: plan.price,
      created_by: userId,
    };
  });
  const { data: memberships } = await admin
    .from("wellness_memberships")
    .insert(membershipRows)
    .select("id, member_id, total_servings, used_servings, remaining_servings");

  if (memberships) {
    await admin.from("serving_transactions").insert(
      memberships.map((ms) => ({
        member_id: ms.member_id,
        membership_id: ms.id,
        txn_type: "membership_allocation",
        change: ms.total_servings,
        balance_after: ms.total_servings,
        created_by: userId,
        note: "Demo allocation",
      })),
    );

    // Attendance for the last 5 days across paid members
    const attendance: Record<string, unknown>[] = [];
    memberships.forEach((ms, idx) => {
      for (let d = 1; d <= 5; d++) {
        if ((idx + d) % 3 === 0) continue;
        attendance.push({
          member_id: ms.member_id,
          membership_id: ms.id,
          visit_date: isoDate(-d),
          visit_time: new Date(Date.now() - d * 86400000).toISOString(),
          serving_deducted: true,
          remaining_balance_snapshot: Math.max(ms.remaining_servings + d, 0),
          checkin_method: "staff_entry",
          staff_id: userId,
        });
      }
    });
    if (attendance.length) await admin.from("wellness_attendance").insert(attendance);
  }

  // Weight history
  const weights: Record<string, unknown>[] = [];
  members.forEach((m) => {
    const start = Number(m.initial_weight ?? 70);
    const end = Number(m.current_weight ?? start);
    for (let w = 0; w < 5; w++) {
      weights.push({
        member_id: m.id,
        recorded_date: isoDate(-(28 - w * 7)),
        weight: Number((start + ((end - start) * w) / 4).toFixed(1)),
        recorded_by: userId,
      });
    }
  });
  await admin.from("weight_tracking").insert(weights);

  await admin.from("member_notes").insert(
    members.slice(0, 5).map((m) => ({
      member_id: m.id,
      note: `${m.full_name.split(" ")[0]} prefers the morning slot and follows a vegetarian meal plan.`,
      created_by: userId,
    })),
  );

  await admin.from("wellness_notification_templates").insert([
    { trigger_key: "trial_day_1", channel: "whatsapp", message_template: "Namaste {{name}}, welcome to your 3-day wellness trial!", created_by: userId },
    { trigger_key: "serving_balance_5", channel: "whatsapp", message_template: "Hi {{name}}, only 5 servings left. Renew to stay on track.", created_by: userId },
    { trigger_key: "membership_activated", channel: "whatsapp", message_template: "Your membership {{code}} is active until {{end_date}}.", created_by: userId },
  ]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users.find((u) => u.email === DEMO_EMAIL);

    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD, email_confirm: true });
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Demo User (Vertos Marketing)" },
      });
      if (error) throw error;
      userId = created.user.id;
      await admin.from("profiles").update({ company: "Vertos Marketing Pvt. Ltd." }).eq("user_id", userId);
    }

    await seed(userId!);
    await seedWellness(userId!);

    return new Response(JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("demo-login error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
