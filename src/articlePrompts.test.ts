import assert from "node:assert/strict";
import test from "node:test";
import { buildArticleCoverPrompt, buildArticleIllustrationPrompt } from "./articlePrompts.js";

test("buildArticleCoverPrompt creates a 16:9 article cover prompt with product focus when an image is provided", () => {
  const prompt = buildArticleCoverPrompt({
    title: "How Insulation Piercing Connectors Improve Distribution Reliability",
    summary: "Technical article for power distribution engineers.",
    usesProductImage: true
  });

  assert.match(prompt, /16:9/);
  assert.match(prompt, /article cover/i);
  assert.match(prompt, /uploaded product image/i);
  assert.match(prompt, /How Insulation Piercing Connectors Improve Distribution Reliability/);
  assert.match(prompt, /Technical article for power distribution engineers/);
});

test("buildArticleCoverPrompt creates a 16:9 text-to-image article cover prompt without uploaded image wording", () => {
  const prompt = buildArticleCoverPrompt({
    title: "Cable Lug Crimping Guide",
    usesProductImage: false
  });

  assert.match(prompt, /16:9/);
  assert.match(prompt, /article cover/i);
  assert.doesNotMatch(prompt, /uploaded product image/i);
  assert.match(prompt, /Cable Lug Crimping Guide/);
});

test("buildArticleIllustrationPrompt creates a 16:9 article illustration prompt", () => {
  const prompt = buildArticleIllustrationPrompt({
    topic: "Step-by-step installation workflow for insulation piercing connectors",
    sectionContext: "Explain safe clamp alignment before tightening."
  });

  assert.match(prompt, /16:9/);
  assert.match(prompt, /illustration/i);
  assert.match(prompt, /Step-by-step installation workflow/);
  assert.match(prompt, /safe clamp alignment/);
});
