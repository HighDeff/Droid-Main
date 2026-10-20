export interface AiReviewFrame {
  screenshotUrl: string;
  frameSize: { width: number; height: number };
}

export async function prepareAiReviewFrame(source?: string | null): Promise<AiReviewFrame> {
  if (!source) throw new Error("Capture or select a current screen before reviewing the workflow.");

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The current screen image could not be loaded for review."));
    image.src = source;
  });
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("The current screen image has no usable dimensions.");

  const frameSize = { width: image.naturalWidth, height: image.naturalHeight };
  if (/^data:image\/(?:png|jpeg);base64,/.test(source)) return { screenshotUrl: source, frameSize };

  const canvas = document.createElement("canvas");
  canvas.width = frameSize.width;
  canvas.height = frameSize.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the current screen image for AI review.");
  context.drawImage(image, 0, 0);
  return { screenshotUrl: canvas.toDataURL("image/jpeg", 0.9), frameSize };
}
