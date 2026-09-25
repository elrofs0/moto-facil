const { PlatformSetting } = require('../models');

// Leitura/escrita de configurações da plataforma que o admin pode mudar
// em runtime, sem deploy — hoje só o modo chuva, mas a tabela é
// genérica (key/value) pra crescer sem precisar de migration nova.

const DEFAULTS = {
  rain_mode: 'false',
};

async function getSetting(key) {
  const row = await PlatformSetting.findByPk(key);
  return row ? row.value : DEFAULTS[key] ?? null;
}

async function setSetting(key, value) {
  await PlatformSetting.upsert({ key, value: String(value) });
  return getSetting(key);
}

async function isRainModeOn() {
  const value = await getSetting('rain_mode');
  return value === 'true';
}

async function setRainMode(isOn) {
  return setSetting('rain_mode', isOn ? 'true' : 'false');
}

module.exports = { getSetting, setSetting, isRainModeOn, setRainMode };
