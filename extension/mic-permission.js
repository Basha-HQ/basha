document.getElementById('btn-allow').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    document.getElementById('btn-allow').style.display = 'none';
    document.getElementById('msg-granted').style.display = 'block';
    document.getElementById('icon').textContent = '\u2705'; // ✅
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    document.getElementById('msg-denied').style.display = 'block';
    console.error('[mic-permission] getUserMedia failed:', err.message);
  }
});
