import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';

import type { CardData } from '@/entities/card/card-data';
import { ALL_STATS, getDefaultStats } from '@/entities/card/card-data';
import type {
  BackgroundMode,
  CardFormat,
  CardSettings,
  PhotoTransform,
  StatKey,
  StudioMode,
  TemplateId,
} from '@/entities/card/card.types';
import { PALETTES, resolvePalette } from '@/entities/card/palettes';
import { decodePhoto, extractPhotoColors } from '@/entities/card/photo';
import type { PhotoAsset } from '@/entities/card/render/env';
import { getTemplate, TEMPLATES } from '@/entities/card/templates';
import { MAP_STYLE_OPTIONS } from '@/shared/lib/map/map-styles';

const STORAGE_KEY = 'rv:studio:v1';
const MAX_STATS = 6;

export const DEFAULT_CARD_SETTINGS: CardSettings = {
  format: 'story',
  templateId: 'minimal',
  paletteId: 'night',
  customColors: null,
  backgroundMode: 'palette',
  photoScrim: 0.55,
  photoBlur: 0,
  routeColorMode: 'solid',
  routeWidth: 1,
  routeGlow: false,
  stats: [],
  title: '',
  showDate: true,
  showBrand: true,
  mapStyle: 'dark',
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Accept only known values from storage so an old or edited entry cannot break rendering. */
function sanitize(raw: unknown): CardSettings {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<CardSettings>;
  const result: CardSettings = { ...DEFAULT_CARD_SETTINGS };

  if (source.format && ['story', 'post', 'square'].includes(source.format))
    result.format = source.format;
  if (source.templateId && TEMPLATES.some((item) => item.id === source.templateId))
    result.templateId = source.templateId;
  if (source.paletteId && PALETTES.some((item) => item.id === source.paletteId))
    result.paletteId = source.paletteId;

  if (
    source.customColors &&
    HEX.test(source.customColors.background) &&
    HEX.test(source.customColors.accent) &&
    HEX.test(source.customColors.text)
  ) {
    result.customColors = { ...source.customColors };
  }

  // A photo is never persisted, so never restore the "photo" mode.
  if (source.backgroundMode === 'transparent' || source.backgroundMode === 'palette') {
    result.backgroundMode = source.backgroundMode;
  }

  if (typeof source.photoScrim === 'number')
    result.photoScrim = Math.min(1, Math.max(0, source.photoScrim));
  if (typeof source.photoBlur === 'number')
    result.photoBlur = Math.min(1, Math.max(0, source.photoBlur));
  if (
    source.routeColorMode &&
    ['solid', 'pace', 'heartRate', 'elevation'].includes(source.routeColorMode)
  ) {
    result.routeColorMode = source.routeColorMode;
  }
  if (typeof source.routeWidth === 'number')
    result.routeWidth = Math.min(2, Math.max(0.5, source.routeWidth));
  if (typeof source.routeGlow === 'boolean') result.routeGlow = source.routeGlow;
  if (Array.isArray(source.stats)) {
    result.stats = source.stats
      .filter((key): key is StatKey => ALL_STATS.includes(key))
      .slice(0, MAX_STATS);
  }
  if (typeof source.showDate === 'boolean') result.showDate = source.showDate;
  if (typeof source.showBrand === 'boolean') result.showBrand = source.showBrand;
  if (source.mapStyle && MAP_STYLE_OPTIONS.some((option) => option.id === source.mapStyle))
    result.mapStyle = source.mapStyle;

  return result;
}

function loadSettings(): CardSettings {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_CARD_SETTINGS };
  }
}

export const useStudioStore = defineStore('studio', () => {
  const settings = ref<CardSettings>(loadSettings());
  const mode = ref<StudioMode>('photo');
  const videoDuration = ref<10 | 15 | 20>(15);
  const photo = shallowRef<PhotoAsset | null>(null);
  const photoTransform = ref<PhotoTransform>({ x: 0, y: 0, scale: 1 });
  const titleActivityId = ref<string | null>(null);

  watch(
    settings,
    (value) => {
      try {
        // The title belongs to one activity; do not carry it over to the next one.
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, title: '' }));
      } catch {
        // ignore quota / private mode
      }
    },
    { deep: true },
  );

  /** Called when the studio opens for an activity. */
  function prepareFor(data: CardData) {
    if (titleActivityId.value !== data.activityId) {
      settings.value.title = '';
      titleActivityId.value = data.activityId;
    }

    const valid = settings.value.stats.filter((key) => data.available[key]);
    settings.value.stats = valid.length ? valid : getDefaultStats(data);

    if (!data.available.heartRate && settings.value.routeColorMode === 'heartRate') {
      settings.value.routeColorMode = 'pace';
    }
  }

  function setTemplate(id: TemplateId) {
    const template = getTemplate(id);
    const keepPhoto =
      settings.value.backgroundMode === 'photo' && photo.value && template.supportsPhoto;

    settings.value.templateId = id;
    settings.value.paletteId = template.defaultPaletteId;
    settings.value.customColors = null;
    settings.value.routeColorMode = template.defaultRouteColorMode;
    settings.value.routeGlow = id === 'neon';
    settings.value.backgroundMode = keepPhoto ? 'photo' : template.defaultBackground;
  }

  function setFormat(format: CardFormat) {
    settings.value.format = format;
  }

  function setPalette(id: string) {
    settings.value.paletteId = id;
    settings.value.customColors = null;

    if (
      settings.value.backgroundMode === 'transparent' &&
      !getTemplate(settings.value.templateId).isSticker
    ) {
      settings.value.backgroundMode = 'palette';
    }
  }

  function setCustomColor(key: 'background' | 'accent' | 'text', value: string) {
    const current =
      settings.value.customColors ??
      (({ background, accent, text }) => ({ background, accent, text }))(
        resolvePalette(settings.value),
      );
    settings.value.customColors = { ...current, [key]: value };
  }

  function setBackgroundMode(value: BackgroundMode) {
    if (value === 'photo' && !photo.value) {
      return;
    }

    settings.value.backgroundMode = value;
  }

  async function setPhoto(file: File) {
    const decoded = await decodePhoto(file);
    const previous = photo.value;

    photo.value = decoded;
    photoTransform.value = { x: 0, y: 0, scale: 1 };

    if (!getTemplate(settings.value.templateId).supportsPhoto) {
      setTemplate('minimal');
    }

    settings.value.backgroundMode = 'photo';

    if (previous?.image instanceof ImageBitmap) {
      previous.image.close();
    }
  }

  function clearPhoto() {
    if (photo.value?.image instanceof ImageBitmap) {
      photo.value.image.close();
    }

    photo.value = null;

    if (settings.value.backgroundMode === 'photo') {
      settings.value.backgroundMode = getTemplate(settings.value.templateId).defaultBackground;
    }
  }

  function applyPhotoColors() {
    if (!photo.value) {
      return;
    }

    settings.value.customColors = extractPhotoColors(photo.value);
  }

  function toggleStat(key: StatKey) {
    const stats = settings.value.stats;

    if (stats.includes(key)) {
      settings.value.stats = stats.filter((item) => item !== key);
    } else if (stats.length < MAX_STATS) {
      settings.value.stats = [...stats, key];
    }
  }

  function moveStat(key: StatKey, direction: -1 | 1) {
    const stats = [...settings.value.stats];
    const index = stats.indexOf(key);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= stats.length) {
      return;
    }

    [stats[index], stats[target]] = [stats[target]!, stats[index]!];
    settings.value.stats = stats;
  }

  function setStats(keys: StatKey[]) {
    settings.value.stats = keys.slice(0, MAX_STATS);
  }

  return {
    settings,
    mode,
    videoDuration,
    photo,
    photoTransform,
    maxStats: MAX_STATS,
    prepareFor,
    setTemplate,
    setFormat,
    setPalette,
    setCustomColor,
    setBackgroundMode,
    setPhoto,
    clearPhoto,
    applyPhotoColors,
    toggleStat,
    moveStat,
    setStats,
  };
});
