window.rgbToHex = (rgbString) => {
  if (/^#([0-9A-Fa-f]{6})$/.test(rgbString)) {
    // Already in hex format
    return rgbString;
  }

  // 1. Extract R, G, B values
  const match = rgbString.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) {
    console.error("Invalid RGB string format.");
    return null; // Or throw an error
  }

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  // 2. Convert each component to hexadecimal and 3. Pad with leading zeros
  const toHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hexR = toHex(r);
  const hexG = toHex(g);
  const hexB = toHex(b);

  // 4. Concatenate and prepend "#"
  return `#${hexR}${hexG}${hexB}`;
};

window.pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
