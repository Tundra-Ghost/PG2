const AVATAR_SIZE = 256;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load avatar image.'));
    image.src = src;
  });
}

export async function createCircularAvatarDataUrl(file: File): Promise<string> {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(sourceUrl);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Avatar canvas is unavailable.');
    }

    const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = Math.floor((image.naturalWidth - cropSize) / 2);
    const sy = Math.floor((image.naturalHeight - cropSize) / 2);

    context.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    context.save();
    context.beginPath();
    context.arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    context.drawImage(
      image,
      sx,
      sy,
      cropSize,
      cropSize,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    context.restore();

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
