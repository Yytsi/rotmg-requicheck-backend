// Hey you. This is a local implementation, so you need to run this on your local machine.
// You need to have Node.js installed on your machine to run this.
const PORT = 3000; // It will run on port 3000. You can change this if you want.
// Alternatively, you can modify it and deploy this to a server and run it there.

import express from "express";
import puppeteer from "puppeteer";
import cors from "cors";
import xss from "xss";
import validator from "validator";
const app = express();

app.use(cors());
app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

async function scrapePlayerDetails(url) {
  // sanitizing here once more to prevent any XSS attacks
  url = xss(url);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
  );
  await page.goto(url, { waitUntil: "networkidle0" });

  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

  const extractedData = await page.evaluate(() => {
    const trElements = document.querySelectorAll("table tr");
    const data = [];

    let base64ImageData = null;
    let fetchedImages = false;

    let characterIndex = 0;
    trElements.forEach((tr) => {
      // Adjust these selectors based on the actual HTML structure
      const items = Array.from(tr.querySelectorAll(".item-wrapper a")).map(
        (a) => a.href
      );

      // Get the parent <td> of the .character element

      const playerStats = tr.querySelector(".player-stats")?.textContent.trim();

      // Query for an element with the `.character` class and get its computed style
      const characterElement = tr.querySelector(".character");
      const characterPicture = characterElement
        ? window.getComputedStyle(characterElement).backgroundImage
        : null;

      const characterTd = characterElement
        ? characterElement.parentElement
        : null;

      // Get the next <td> after the one containing .character
      const nextTd = characterTd ? characterTd.nextElementSibling : null;

      // Get the content of the next <td>
      const nextTdContent = nextTd ? nextTd.textContent.trim() : null;

      // Extract base64 data from the background image if it's there
      const base64ImageMatch = characterPicture?.match(
        /url\("data:image\/png;base64,(.+?)"\)/
      );

      if (!fetchedImages && base64ImageMatch) {
        base64ImageData = base64ImageMatch[1];
      }

      // if items has length over 4, trim to 4 from end
      if (items.length > 4) {
        items.splice(4, items.length - 4);
      }

      if (items.length > 0 && playerStats && base64ImageData) {
        data.push({
          items,
          playerStats,
          characterIndex,
          characterClass: nextTdContent.toLowerCase(),
        });
        characterIndex++;
      }
    });

    return { characterData: data, base64ImageData };
  });

  await browser.close();
  return extractedData;
}

app.get("/get_player_data", async (req, res) => {
  let { url } = req.query; // Get the URL from query parameters

  if (!url) {
    return res.status(400).send({ error: "URL is required" });
  }

  if (
    !validator.isURL(url, { protocols: ["https"], require_protocol: true }) ||
    !url.includes("https://www.realmeye.com/player/")
  ) {
    return res.status(400).send({ error: "Invalid URL" });
  }

  url = xss(url); // Sanitize the URL to prevent XSS attacks

  try {
    const data = await scrapePlayerDetails(url);
    res.json(data);
  } catch (error) {
    console.error("Scraping failed:", error);
    res.status(500).send({ error: "Failed to scrape data" });
  }
});
