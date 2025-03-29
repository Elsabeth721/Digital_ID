import { Telegraf } from "telegraf";
import { BOT_TOKEN } from "./config";
import { saveUserData, supabase, uploadToStorage } from "./database";
import { generateID } from "./generate_Id";
import * as fs from "fs";
import path from "path";
import https from "https";
import { Agent } from "undici";
import fetch from "node-fetch";

const bot = new Telegraf(BOT_TOKEN, {
  telegram: {
    agent: new https.Agent({
      keepAlive: true,
      timeout: 30000,
      rejectUnauthorized: true,
    }),
    webhookReply: false,
    apiRoot: "https://api.telegram.org",
    // retryAfter: 1 // Removed as it is not a valid property
  },
});
const fetchOptions = {
  dispatcher: new Agent({
    connect: {
      timeout: 30000,
    },
  }),
};

const enPath = path.join(__dirname, "templates", "en.json");
const amPath = path.join(__dirname, "templates", "am.json");

const en = JSON.parse(fs.readFileSync(enPath, "utf-8")) as Record<
  string,
  string
>;
const am = JSON.parse(fs.readFileSync(amPath, "utf-8")) as Record<
  string,
  string
>;

function t(userId: string, key: string): string {
  const session = userSessions[userId];
  const lang = session?.language || "en";
  return lang === "am" ? am[key] : en[key];
}

interface UserSession {
  step: string;
  isSelf: boolean;
  creatorId: string;
  language: "en" | "am";
  fullName?: string;
  motherName?: string;
  religiousName?: string;
  confessionFatherName?: string;
  age?: number;
  phone?: string;
  email?: string | null;
  educationStatus?: "Diploma" | "Degree" | "Masters" | "PhD" | "Other" | "None";
  serviceClass?:
    | "Charity"
    | "Child"
    | "Educational"
    | "Curriculum"
    | "Furtherance"
    | "Anthem"
    | "Member"
    | "Amerar"
    | "Other"
    | "None";
  fieldOfStudy?: string;
  currentWork?: string;
  photoUrl?: string;
  location?: string;
}

const userSessions: Record<string, UserSession> = {};

function generateUniqueId(userId: string): string {
  return `id_${userId}_${Date.now()}`;
}

function isValidName(name: string): boolean {
  return /^[\p{L}\s]{2,100}$/u.test(name);
}

function isValidAge(age: number): boolean {
  return age >= 3 && age <= 100;
}

function isValidPhone(phone: string): boolean {
  return /^\d{10}$/.test(phone);
}

function isValidEmail(email: string): boolean {
  if (email === "skip") return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

bot.action(/^setlang_/, async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const lang = ctx.match.input.split("_")[1] as "en" | "am";

  if (!userSessions[userId]) {
    userSessions[userId] = {
      step: "name",
      isSelf: true,
      creatorId: userId,
      language: lang,
    };
  } else {
    userSessions[userId].language = lang;
  }

  await ctx.reply(
    lang === "en"
      ? "Language set to English. Let's begin!"
      : "ቋንቋ አማርኛ ተብሎ ተዘጋጅቷል። እንጀምር!"
  );

  await ctx.reply(t(userId, "welcome"));
  await ctx.reply(t(userId, "fullNamePrompt"));
});

bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();

  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("creator_id", userId)
    .eq("is_self", true)
    .single();

  if (data) {
    ctx.reply(t(userId, "alreadyHaveId"));
  } else {
    await ctx.reply("Please select your language / ቋንቋ ይምረጡ:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "English", callback_data: "setlang_en" },
            { text: "አማርኛ", callback_data: "setlang_am" },
          ],
        ],
      },
    });
  }
});

bot.command("new", (ctx) => {
  const userId = ctx.from.id.toString();

  ctx.reply("Please select your language / ቋንቋ ይምረጡ:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "English", callback_data: "setlang_en" },
          { text: "አማርኛ", callback_data: "setlang_am" },
        ],
      ],
    },
  });

  userSessions[userId] = {
    step: "name",
    isSelf: false,
    creatorId: userId,
    language: "en",
  };
});

bot.on("text", async (ctx) => {
  const userId = ctx.from.id.toString();
  const session = userSessions[userId];

  if (!session) return;

  try {
    if (session.step === "photo") {
      await ctx.reply(t(userId, "photoRequired"));
      return;
    }

    if (session.step === "location") {
      await ctx.reply(t(userId, "locationRequired"), {
        reply_markup: {
          keyboard: [
            [{ text: t(userId, "shareLocation"), request_location: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
      return;
    }

    switch (session.step) {
      case "name":
        if (!isValidName(ctx.message.text)) {
          throw new Error(t(userId, "invalidName"));
        }
        session.fullName = ctx.message.text;
        session.step = "motherName";
        return ctx.reply(t(userId, "motherNamePrompt"));

      case "motherName":
        if (!isValidName(ctx.message.text)) {
          throw new Error(t(userId, "invalidName"));
        }
        session.motherName = ctx.message.text;
        session.step = "religiousName";
        return ctx.reply(t(userId, "religiousNamePrompt"));

      case "religiousName":
        if (!isValidName(ctx.message.text)) {
          throw new Error(t(userId, "invalidName"));
        }
        session.religiousName = ctx.message.text;
        session.step = "confessionFatherName";
        return ctx.reply(t(userId, "confessionFatherNamePrompt"));

      case "confessionFatherName":
        if (!isValidName(ctx.message.text)) {
          throw new Error(t(userId, "invalidName"));
        }
        session.confessionFatherName = ctx.message.text;
        session.step = "age";
        return ctx.reply(t(userId, "agePrompt"));

      case "age":
        const age = parseInt(ctx.message.text);
        if (isNaN(age)) {
          throw new Error(t(userId, "invalidAge"));
        }
        if (!isValidAge(age)) {
          throw new Error(t(userId, "invalidAge"));
        }
        session.age = age;
        session.step = "phone";
        return ctx.reply(t(userId, "phonePrompt"));

      case "phone":
        if (!isValidPhone(ctx.message.text)) {
          throw new Error(t(userId, "invalidPhone"));
        }
        session.phone = ctx.message.text;
        session.step = "email";
        return ctx.reply(t(userId, "emailPrompt"));

      case "email":
        if (!isValidEmail(ctx.message.text)) {
          throw new Error(t(userId, "invalidEmail"));
        }
        session.email = ctx.message.text === "skip" ? null : ctx.message.text;
        session.step = "education";

        const diplomaText = t(userId, "Diploma");
        const degreeText = t(userId, "Degree");
        const mastersText = t(userId, "Masters");
        const phdText = t(userId, "PhD");
        const otherText = t(userId, "Other");
        const noneText = t(userId, "None");

        return ctx.reply(t(userId, "educationPrompt"), {
          reply_markup: {
            inline_keyboard: [
              [
                { text: diplomaText, callback_data: "education_Diploma" },
                { text: degreeText, callback_data: "education_Degree" },
              ],
              [
                { text: mastersText, callback_data: "education_Masters" },
                { text: phdText, callback_data: "education_PhD" },
              ],
              [
                { text: otherText, callback_data: "education_Other" },
                { text: noneText, callback_data: "education_None" },
              ],
            ],
          },
        });
      case "fieldOfStudy":
        if (ctx.message.text.length < 2 || ctx.message.text.length > 100) {
          throw new Error(t(userId, "invalidFieldOfStudy"));
        }
        session.fieldOfStudy = ctx.message.text;
        session.step = "currentWork";
        return ctx.reply(t(userId, "currentWorkPrompt"));

      case "currentWork":
        if (ctx.message.text.length < 2 || ctx.message.text.length > 100) {
          throw new Error(t(userId, "invalidCurrentWork"));
        }
        session.currentWork = ctx.message.text;
        session.step = "serviceClass";

        const CharityText = t(userId, "Charity");
        const ChildText = t(userId, "Child");
        const EducationalText = t(userId, "Educational");
        const CurriculumText = t(userId, "Curriculum");
        const FurtheranceText = t(userId, "Furtherance");
        const AnthemText = t(userId, "Anthem");
        const MemberText = t(userId, "Member");
        const AmerarText = t(userId, "Amerar");
        const OthersText = t(userId, "Others");
        const NonesText = t(userId, "Nones");

        return ctx.reply(t(userId, "serviceClassPrompt"), {
          reply_markup: {
            inline_keyboard: [
              [
                { text: CharityText, callback_data: "service_Charity" },
                { text: ChildText, callback_data: "service_Child" },
              ],
              [
                { text: EducationalText, callback_data: "service_Educational" },
                { text: CurriculumText, callback_data: "service_Curriculum" },
              ],
              [
                { text: FurtheranceText, callback_data: "service_Furtherance" },
                { text: AnthemText, callback_data: "service_Anthem" },
              ],
              [
                { text: MemberText, callback_data: "service_Member" },
                { text: AmerarText, callback_data: "service_Amerar" },
              ],
              [
                { text: OthersText, callback_data: "service_Other" },
                { text: NonesText, callback_data: "service_None" },
              ],
            ],
          },
        });
    }
  } catch (error) {
    ctx.reply(
      error instanceof Error ? error.message : t(userId, "invalidInput")
    );
  }
});

bot.action(/^education_/, async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const session = userSessions[userId];
  if (!session || session.step !== "education") return;

  const selected = ctx.match.input.split("_")[1];
  session.educationStatus = selected as any;

  await ctx.reply(`✅ ${t(userId, "Selected")}: ${selected}`);
  await ctx.reply(t(userId, "fieldOfStudyPrompt"));
  session.step = "fieldOfStudy";
});

bot.action(/^service_/, async (ctx) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const session = userSessions[userId];
  if (!session || session.step !== "serviceClass") return;

  const selected = ctx.match.input.split("_")[1];
  session.serviceClass = selected as any;

  await ctx.reply(`✅ ${t(userId, "Selected")}: ${selected}`);
  await ctx.reply(t(userId, "photoPrompt"));
  session.step = "photo";
});

bot.on("photo", async (ctx) => {
  const userId = ctx.from.id.toString();
  const session = userSessions[userId];

  if (!session || session.step !== "photo") {
    return ctx.reply(t(userId, "photoRequired"));
  }

  const MAX_RETRIES = 3;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);

      const response = await fetch(fileLink.href, {
        agent: new https.Agent({ keepAlive: true }),
      });
      if (!response.ok) throw new Error("Failed to fetch photo");

      const photoBuffer = Buffer.from(await response.arrayBuffer());

      try {
        const { data: oldPhotos } = await supabase.storage
          .from("id-cards")
          .list("profiles", { search: `profile_${userId}_` });

        if (oldPhotos?.length) {
          await supabase.storage
            .from("id-cards")
            .remove(oldPhotos.map((f) => `profiles/${f.name}`));
        }
      } catch (cleanupError) {
        console.warn("Photo cleanup skipped:", cleanupError);
      }

      session.photoUrl = await uploadToStorage(photoBuffer, "profile", userId);

      session.step = "location";
      await ctx.reply(t(userId, "photoReceived"));
      await ctx.reply(t(userId, "locationPrompt"), {
        reply_markup: {
          keyboard: [
            [{ text: t(userId, "shareLocation"), request_location: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
      break;
    } catch (error) {
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        console.error(
          `Photo upload failed after ${MAX_RETRIES} attempts:`,
          error
        );
        await ctx.reply(t(userId, "photoUploadFailed"));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
    }
  }
});

bot.on("location", async (ctx) => {
  const userId = ctx.from.id.toString();
  const session = userSessions[userId];

  if (!session) {
    await ctx.reply(t(userId, "locationRequired"));
    return;
  }

  if (session.step !== "location") {
    await ctx.reply(t(userId, "locationRequired"));
    return;
  }

  try {
    session.location = `Lat: ${ctx.message.location.latitude}, Lng: ${ctx.message.location.longitude}`;

    const uniqueId = session.isSelf ? userId : generateUniqueId(userId);

    await ctx.reply(t(userId, "generatingId"));
    const idCardPath = await generateID(
      uniqueId,
      session.fullName || "",
      session.religiousName || "",
      session.phone || "",
      session.email || "",
      session.photoUrl || "",
      session.language
    );

    const idCardBuffer = fs.readFileSync(idCardPath);
    const idCardUrl = await uploadToStorage(idCardBuffer, "id-card", userId);

    await saveUserData(
      uniqueId,
      session.creatorId,
      session.isSelf,
      session.fullName || "",
      session.motherName || "",
      session.religiousName || "",
      session.confessionFatherName || "",
      session.age || 0,
      session.phone || "",
      session.email || "",
      session.educationStatus ?? "None",
      session.serviceClass ?? "None",
      session.fieldOfStudy || "",
      session.currentWork || "",
      session.photoUrl || "",
      session.location || "",
      idCardUrl
    );

    await ctx.replyWithPhoto({ source: idCardPath });
    await ctx.reply(t(userId, "idCreated"));
    fs.unlinkSync(idCardPath);
    delete userSessions[userId];
  } catch (error) {
    console.error("Error:", error);
    await ctx.reply(t(userId, "idCreationError"));
    delete userSessions[userId];
  }
});

let connectionFailures = 0;
const MAX_FAILURES = 5;

bot.catch((err, ctx) => {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err.code === "ECONNRESET" || err.code === "UND_ERR_CONNECT_TIMEOUT")
  ) {
    connectionFailures++;
    if (connectionFailures >= MAX_FAILURES) {
      console.error("Critical connection failures - restarting...");
      process.exit(1);
    }
  }
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply(t(ctx.from?.id.toString() || "", "errorOccurred"));
});

setInterval(async () => {
  try {
    await bot.telegram.getMe();
    connectionFailures = 0;
    console.log("Health check passed");
  } catch (err) {
    console.error("Health check failed:", err);
  }
}, 300000);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

async function startBotWithRetry(maxRetries = 3, retryDelay = 5000) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await bot.launch();
      console.log("✅ Bot is running...");
      return;
    } catch (err) {
      retries++;
      console.error(
        `❌ Bot failed to start (attempt ${retries}/${maxRetries}):`,
        err instanceof Error ? err.message : String(err)
      );

      if (retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.error("❌ Failed to start bot after maximum retries");
  process.exit(1);
}

startBotWithRetry();
