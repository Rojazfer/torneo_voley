export function compressImageFile(file, options = {}) {
  const {
    maxWidth = 320,
    maxHeight = 320,
    quality = 0.72,
    mimeType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    if (!file.type?.startsWith('image/')) {
      reject(new Error('Selecciona una imagen valida.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
      image.onload = () => {
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL(mimeType, quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function compressTeamLogo(file) {
  return compressImageFile(file, {
    maxWidth: 320,
    maxHeight: 320,
    quality: 0.76,
  });
}

export async function compressPlayerPhoto(file) {
  return compressImageFile(file, {
    maxWidth: 240,
    maxHeight: 320,
    quality: 0.7,
  });
}
