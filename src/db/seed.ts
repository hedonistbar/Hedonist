// Seeds the pilot tenant (Hedonist Bar & Kitchen) per SPEC.md Appendix A.
// Idempotent: safe to re-run, upserts on slug / restaurant_id.
import { getSupabase } from "./client.js";

async function main() {
  const db = getSupabase();

  const { data: restaurant, error: restaurantError } = await db
    .from("restaurants")
    .upsert(
      {
        slug: "hedonist",
        name: "Hedonist Bar & Kitchen",
        timezone: "Europe/Kyiv",
        languages: ["uk", "en"],
      },
      { onConflict: "slug" }
    )
    .select("*")
    .single();
  if (restaurantError) throw restaurantError;
  console.log(`restaurant: ${restaurant.name} (${restaurant.id})`);

  const { error: brandError } = await db.from("brand_context").upsert(
    {
      restaurant_id: restaurant.id,
      name: "Hedonist Bar & Kitchen",
      short_description:
        "Гастробар «про гедонізм» у Києві (вул. Антоновича 45, м. «Олімпійська»). Instagram: @hedonist_bar.",
      concept:
        "Гастробар про задоволення від смаку, коктейлів і атмосфери; ф'южн американської та азійської кухні, власна коптильня.",
      philosophy: "Легкість і насолода без пафосу; тепла, трохи іронічна подача; «для тебе, щодня».",
      brand_values: "Смак, дим, атмосфера, гостинність без корпоративності.",
      voice_tone: "Живий, гостинний, не корпоративний тон; акцент на смак, дим, атмосферу.",
      voice_examples_do: [],
      voice_examples_dont: [],
      target_audience: "Місцеві гості та туристи; вечірня публіка, компанії, побачення.",
      flagship_items: [
        { name: "Бургер Black Truffle", description: "трюфельний айолі", priority: 1 },
        { name: "Beef Ribs", description: "копчені реберця BBQ", priority: 1 },
        { name: "Pork Wing", priority: 2 },
        { name: "Animal Style Fries", priority: 2 },
        { name: "Том Ям з тигровими креветками", priority: 2 },
        { name: "Сигнатурні коктейлі", description: "на house-made настойках", priority: 1 },
        { name: "Десерт-брауні", priority: 3 },
      ],
      regular_events: [
        { name: "Жива музика", schedule: "щосереди" },
        { name: "Дегустації коктейлів і вініловий DJ-сет", schedule: "щоп'ятниці та щосуботи" },
      ],
      content_languages: { primary: "uk", secondary: "en" },
      taboo_topics: [
        "Воєнна реальність — обережний тон у тривожні періоди",
        'Заклад позиціонується як "Бар-укриття" — уточнити подачу з власником',
      ],
      reference_posts: [],
    },
    { onConflict: "restaurant_id" }
  );
  if (brandError) throw brandError;
  console.log("brand_context: seeded");

  const { error: settingsError } = await db.from("settings").upsert(
    {
      restaurant_id: restaurant.id,
      posting_slots: { wed: ["19:00"], fri: ["20:00"], sat: ["20:00"] },
      auto_reply_enabled: true,
      daily_cycle_time: "09:00",
      inbox_check_interval_minutes: 30,
      reviews_check_interval_minutes: 120,
      alert_mode: false,
    },
    { onConflict: "restaurant_id" }
  );
  if (settingsError) throw settingsError;
  console.log("settings: seeded");

  const faqRows = [
    { category: "address", question: "Де ви знаходитесь?", answer: "Київ, вул. Антоновича 45, метро «Олімпійська»." },
    { category: "hours", question: "Який у вас графік роботи?", answer: "Уточнюється власником." },
    { category: "reservation", question: "Як забронювати столик?", answer: "Уточнюється власником." },
  ];
  for (const row of faqRows) {
    const { error } = await db
      .from("info_faq")
      .upsert({ restaurant_id: restaurant.id, ...row }, { onConflict: "restaurant_id,category,question" });
    if (error) throw error;
  }
  console.log(`info_faq: seeded ${faqRows.length} starter entries (edit/expand via bot or DB)`);

  console.log("\nSeed complete. Restaurant users are created on first /start in Telegram (bootstrap-as-owner).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
