/** Local CC0 catalogue. Texture tags are Editor descriptions, not listening-history inferences. */
export const SOUND_CATALOG = [
  {
    "id": "kenney-spaceenginelow-000",
    "title": "Low engine bed",
    "tags": [
      "low",
      "sustained",
      "engine"
    ],
    "url": "/sounds/kenney/spaceEngineLow_000.wav",
    "source": {
      "creator": "Kenney",
      "collection": "Sci-Fi Sounds 1.0",
      "page": "https://kenney.nl/assets/sci-fi-sounds",
      "license": "CC0-1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "originalFile": "Audio/spaceEngineLow_000.ogg",
      "sha256": "9a100baea0e3df44801b21e91348d5587d5eb3e189b1e65ace683a750a676ff7",
      "originalSha256": "d7deee8d7217ce63aab802ad7365a59cacfd243392dc1bd03b0a9d454aa494df",
      "processing": "Converted from Ogg to mono 22050 Hz PCM WAV; no source music or private input used."
    }
  },
  {
    "id": "kenney-enginecircular-000",
    "title": "Circular engine",
    "tags": [
      "cyclic",
      "sustained",
      "engine"
    ],
    "url": "/sounds/kenney/engineCircular_000.wav",
    "source": {
      "creator": "Kenney",
      "collection": "Sci-Fi Sounds 1.0",
      "page": "https://kenney.nl/assets/sci-fi-sounds",
      "license": "CC0-1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "originalFile": "Audio/engineCircular_000.ogg",
      "sha256": "f833f0c43d85eb674f072791d603b57b327158b83dc54a82e55b15a215b47dca",
      "originalSha256": "8ab85f9fa85e9e692287f98acb36b9ac3ba15313b007c039055e286b736f4e3a",
      "processing": "Converted from Ogg to mono 22050 Hz PCM WAV; no source music or private input used."
    }
  },
  {
    "id": "kenney-computernoise-000",
    "title": "Computer noise",
    "tags": [
      "digital",
      "noise",
      "machine"
    ],
    "url": "/sounds/kenney/computerNoise_000.wav",
    "source": {
      "creator": "Kenney",
      "collection": "Sci-Fi Sounds 1.0",
      "page": "https://kenney.nl/assets/sci-fi-sounds",
      "license": "CC0-1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "originalFile": "Audio/computerNoise_000.ogg",
      "sha256": "04a4b1e4f652326dc9503e0061bcfbf3019b287efbe42c685166717c219cb0d8",
      "originalSha256": "1527944e16eb14b48ee03fe3e7ce6aae94262833a4e1f83928d451a7414fe4e1",
      "processing": "Converted from Ogg to mono 22050 Hz PCM WAV; no source music or private input used."
    }
  },
  {
    "id": "kenney-forcefield-000",
    "title": "Force field",
    "tags": [
      "digital",
      "electric",
      "short"
    ],
    "url": "/sounds/kenney/forceField_000.wav",
    "source": {
      "creator": "Kenney",
      "collection": "Sci-Fi Sounds 1.0",
      "page": "https://kenney.nl/assets/sci-fi-sounds",
      "license": "CC0-1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "originalFile": "Audio/forceField_000.ogg",
      "sha256": "9c65cc44dbcb67d0d3e18b68aa30a96f016f7f3faa33d18f24036c5ade0cd01e",
      "originalSha256": "c2916f2a062c8ddd1aca2826d134fe90847037db31342726ffb0f9097afe339c",
      "processing": "Converted from Ogg to mono 22050 Hz PCM WAV; no source music or private input used."
    }
  },
  {
    "id": "kenney-impactmetal-000",
    "title": "Metal impact",
    "tags": [
      "metal",
      "percussive",
      "short"
    ],
    "url": "/sounds/kenney/impactMetal_000.wav",
    "source": {
      "creator": "Kenney",
      "collection": "Sci-Fi Sounds 1.0",
      "page": "https://kenney.nl/assets/sci-fi-sounds",
      "license": "CC0-1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "originalFile": "Audio/impactMetal_000.ogg",
      "sha256": "89aaa4f036118c33a413dac468c753a19bf0282a5e82e9640f679d54833f6c57",
      "originalSha256": "956c6612a256aa1a67a2327fffe2454f6b1d82e4c1c2be28fd66916335d5b1d6",
      "processing": "Converted from Ogg to mono 22050 Hz PCM WAV; no source music or private input used."
    }
  },
  {
    "id": "kenney-slime-000",
    "title": "Slime texture",
    "tags": [
      "fluid",
      "texture",
      "short"
    ],
    "url": "/sounds/kenney/slime_000.wav",
    "source": {
      "creator": "Kenney",
      "collection": "Sci-Fi Sounds 1.0",
      "page": "https://kenney.nl/assets/sci-fi-sounds",
      "license": "CC0-1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "originalFile": "Audio/slime_000.ogg",
      "sha256": "0a3f14dad8edcea32390eecac0fe21a7bd3d872ca44cf49258cf3c24cc3948ba",
      "originalSha256": "480ee82b690136ea9db6966a3c3033356b8274752795c4e37afd6b6defcfacff",
      "processing": "Converted from Ogg to mono 22050 Hz PCM WAV; no source music or private input used."
    }
  }
];
export const SOUND_TAGS = [...new Set(SOUND_CATALOG.flatMap(s=>s.tags))].sort();
export function rankSounds(tags:string[]){return SOUND_CATALOG.map(sound=>({sound,matched:tags.filter(tag=>sound.tags.includes(tag))})).sort((a,b)=>b.matched.length-a.matched.length||a.sound.id.localeCompare(b.sound.id));}
