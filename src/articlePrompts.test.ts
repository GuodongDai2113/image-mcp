import assert from "node:assert/strict";
import test from "node:test";
import { buildArticleCoverPrompt, buildArticleIllustrationPrompt } from "./articlePrompts.js";

test("buildArticleCoverPrompt creates a 16:9 article cover prompt with product focus when an image is provided", () => {
  const prompt = buildArticleCoverPrompt({
    title: "How Insulation Piercing Connectors Improve Distribution Reliability",
    summary: "Technical article for power distribution engineers.",
    usesProductImage: true,
    usesLogoImage: true
  });

  assert.match(prompt, /16:9/);
  assert.match(prompt, /article cover/i);
  assert.match(prompt, /uploaded product image/i);
  assert.match(prompt, /Image 2 is the uploaded Logo/i);
  assert.match(prompt, /Logo's dominant color/i);
  assert.match(prompt, /cover's primary color palette/i);
  assert.match(prompt, /How Insulation Piercing Connectors Improve Distribution Reliability/);
  assert.match(prompt, /Technical article for power distribution engineers/);
  assert.doesNotMatch(prompt, /do not render the title/i);
});

test("buildArticleCoverPrompt preserves the original Git prompt when no logo is provided", () => {
  const prompt = buildArticleCoverPrompt({
    title: "Cable Lug Crimping Guide",
    usesProductImage: false,
    usesLogoImage: false
  });

  assert.equal(prompt, [
    "Create a 16:9 article cover image. Create the cover from text only, with a relevant product or application scenario implied by the article title. Design for a technical blog or company article. Use the application scenario as background.",
    "Article title: Cable Lug Crimping Guide",
    "Article summary or audience context: not provided."
  ].join("\n"));
});

test("buildArticleCoverPrompt identifies a logo-only reference as image 1", () => {
  const prompt = buildArticleCoverPrompt({
    title: "Grid Modernization",
    usesProductImage: false,
    usesLogoImage: true
  });

  assert.match(prompt, /Image 1 is the uploaded Logo/i);
  assert.doesNotMatch(prompt, /Image 2 is the uploaded Logo/i);
});

test("buildArticleIllustrationPrompt preserves the original Git prompt when no logo is provided", () => {
  const prompt = buildArticleIllustrationPrompt({
    topic: "Step-by-step installation workflow for insulation piercing connectors",
    sectionContext: "Explain safe clamp alignment before tightening.",
    usesProductImage: false,
    usesLogoImage: false
  });

  assert.equal(prompt, [
    "Create a 16:9 illustration. ",
    "Illustration topic: Step-by-step installation workflow for insulation piercing connectors",
    "Section context: Explain safe clamp alignment before tightening."
  ].join("\n"));
});

test("buildArticleIllustrationPrompt preserves an optional logo reference", () => {
  const prompt = buildArticleIllustrationPrompt({
    topic: "Smart grid monitoring workflow",
    usesProductImage: false,
    usesLogoImage: true
  });

  assert.match(prompt, /Image 1 is the uploaded Logo/i);
  assert.match(prompt, /preserving its original appearance, proportions, and colors/i);
  assert.match(prompt, /Logo's dominant color/i);
  assert.match(prompt, /illustration's primary color palette/i);
});

test("buildArticleIllustrationPrompt identifies optional product and logo references in upload order", () => {
  const prompt = buildArticleIllustrationPrompt({
    topic: "Suspension clamp installation workflow",
    usesProductImage: true,
    usesLogoImage: true
  });

  assert.match(prompt, /Image 1 is the uploaded product image/i);
  assert.match(prompt, /main visual subject of the illustration/i);
  assert.match(prompt, /Image 2 is the uploaded Logo/i);
});
