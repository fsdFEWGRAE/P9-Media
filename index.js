import express from "express";
import axios from "axios";
import fs from "fs";
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

// ============ قراءة الإعدادات من config.json ============
let config;
try {
  config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
} catch (err) {
  console.error("❌ لا يمكن قراءة config.json:", err.message);
  process.exit(1);
}

const {
  mediaChannel,
  youtubeChannelId,
  tiktokUsername,
  checkInterval
} = config;

// ============ قراءة حالة آخر فيديوهات من state.json ============
let state = {
  lastYoutubeVideo: "",
  lastTikTokVideo: ""
};

try {
  if (fs.existsSync("./state.json")) {
    const raw = fs.readFileSync("./state.json", "utf8");
    state = JSON.parse(raw);
  } else {
    fs.writeFileSync("./state.json", JSON.stringify(state, null, 2));
  }
} catch (err) {
  console.error("❌ مشكلة في state.json:", err.message);
}

let lastYoutubeVideo = state.lastYoutubeVideo || "";
let lastTikTokVideo = state.lastTikTokVideo || "";

// دالة حفظ الحالة
function saveState() {
  try {
    fs.writeFileSync(
      "./state.json",
      JSON.stringify(
        {
          lastYoutubeVideo,
          lastTikTokVideo
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error("❌ فشل حفظ state.json:", err.message);
  }
}

// ============ المتغيرات السرية من Render ENV ============
const token = process.env.token;
const youtubeApiKey = process.env.youtubeApiKey;

if (!token) console.log("❌ ERROR: متغير ENV اسمه token غير موجود في Render");
if (!youtubeApiKey)
  console.log("❌ ERROR: متغير ENV اسمه youtubeApiKey غير موجود في Render");

// ============ إعداد عميل ديسكورد ============
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// ============ Keep Alive لـ Render ============
const app = express();
app.get("/", (req, res) => res.send("Media Bot Running!"));
app.listen(process.env.PORT || 3000);

// ===================================================================
//                    🌟 رسالة اليوتيوب
// ===================================================================
async function sendYouTube(title, link, thumbnail) {
  const channel = client.channels.cache.get(mediaChannel);
  if (!channel) {
    console.log("❌ لم يتم العثور على روم الميديا");
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("🎬 مشاهدة على اليوتيوب")
      .setStyle(ButtonStyle.Link)
      .setURL(link)
  );

  await channel.send({
    content: "@everyone",
    embeds: [
      {
        title: "🎥 فيديو جديد على اليوتيوب!",
        description: `**${title}**`,
        url: link,
        color: 0xff0000,
        image: { url: thumbnail },
        footer: { text: "YouTube Auto Poster" }
      }
    ],
    components: [row]
  });

  console.log("✅ تم إرسال فيديو يوتيوب:", title);
}

// ===================================================================
//                    🌟 رسالة التيكتوك
// ===================================================================
async function sendTikTok(title, link, thumbnail) {
  const channel = client.channels.cache.get(mediaChannel);
  if (!channel) {
    console.log("❌ لم يتم العثور على روم الميديا");
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("🎵 مشاهدة على تيك توك")
      .setStyle(ButtonStyle.Link)
      .setURL(link)
  );

  await channel.send({
    content: "@everyone",
    embeds: [
      {
        title: "🎵 مقطع جديد على تيك توك!",
        description: `**${title}**`,
        url: link,
        color: 0x00ffff,
        image: { url: thumbnail },
        footer: { text: "TikTok Auto Poster" }
      }
    ],
    components: [row]
  });

  console.log("✅ تم إرسال فيديو تيك توك:", title);
}

// ===================================================================
//                    🔍 فحص يوتيوب
// ===================================================================
async function checkYouTube() {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${youtubeApiKey}&channelId=${youtubeChannelId}&order=date&part=snippet&type=video&maxResults=1`;
    const res = await axios.get(url);

    const video = res.data.items?.[0];
    if (!video) return;

    const videoId = video.id.videoId;
    const title = video.snippet.title;
    const thumbnail =
      video.snippet.thumbnails?.maxres?.url ||
      video.snippet.thumbnails?.high?.url ||
      video.snippet.thumbnails?.default?.url;

    if (!videoId) return;

    // منع التكرار
    if (videoId === lastYoutubeVideo) {
      // console.log("يوتيوب: لا يوجد فيديو جديد");
      return;
    }

    // تحديث آخر فيديو وتخزينه
    lastYoutubeVideo = videoId;
    saveState();

    const link = `https://www.youtube.com/watch?v=${videoId}`;
    await sendYouTube(title, link, thumbnail);
  } catch (err) {
    console.log("YouTube Error:", err.message);
  }
}

// ===================================================================
//                    🔍 فحص تيك توك
// ===================================================================
async function checkTikTok() {
  try {
    const api = `https://www.tikwm.com/api/user/posts/?unique_id=${tiktokUsername}&count=1`;
    const res = await axios.get(api);

    const data = res.data?.data?.videos?.[0];
    if (!data) return;

    const realId = data.video_id || data.aweme_id;
    if (!realId) {
      console.log("❌ لا يمكن تحديد ID الحقيقي لفيديو تيكتوك");
      return;
    }

    const title = data.title || "TikTok Video";
    const cover = data.cover;

    const tiktokUrl = `https://www.tiktok.com/@${tiktokUsername}/video/${realId}`;

    // منع التكرار
    if (realId === lastTikTokVideo) {
      // console.log("تيكتوك: لا يوجد فيديو جديد");
      return;
    }

    lastTikTokVideo = realId;
    saveState();

    await sendTikTok(title, tiktokUrl, cover);
  } catch (err) {
    console.log("TikTok Error:", err.message);
  }
}

// ===================================================================
//                    🚀 تشغيل البوت
// ===================================================================
client.on("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  const intervalMs = (Number(checkInterval) || 60) * 1000;

  // أول فحص بعد التشغيل بدقايق بسيطة عشان ما يسبام وقت كل Deploy
  setTimeout(() => {
    checkYouTube();
    checkTikTok();

    setInterval(() => {
      checkYouTube();
      checkTikTok();
    }, intervalMs);
  }, 5000);

  console.log(`⏱️ سيتم الفحص كل ${intervalMs / 1000} ثانية`);
});

client.login(token);
