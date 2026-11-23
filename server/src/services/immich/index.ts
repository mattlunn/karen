import config from '../../config';

export interface ImmichAsset {
  id: string;
  localDateTime: string;
  people?: { name: string }[];
  exifInfo?: {
    city: string | null;
    description: string | null;
  } | null;
}

interface SearchMetadataResponse {
  assets: {
    items: ImmichAsset[];
    nextPage: string | null;
  };
}

async function request(path: string, init: { method?: string; body?: string } = {}): Promise<Response> {
  const response = await fetch(`${config.immich.url}/api${path}`, {
    ...init,
    headers: {
      'x-api-key': config.immich.api_key,
      ...(init.body !== undefined && { 'Content-Type': 'application/json' })
    }
  });

  if (!response.ok) {
    throw new Error(`Immich returned a ${response.status} for ${path}`);
  }

  return response;
}

export interface ImmichAlbum {
  id: string;
  albumName: string;
  assetCount: number;
}

export async function getAlbums(): Promise<ImmichAlbum[]> {
  return await (await request('/albums')).json() as ImmichAlbum[];
}

export async function getAlbumImages(albumId: string): Promise<ImmichAsset[]> {
  const assets: ImmichAsset[] = [];
  let page: number | null = 1;

  while (page !== null) {
    const response = await request('/search/metadata', {
      method: 'POST',
      body: JSON.stringify({ albumIds: [albumId], type: 'IMAGE', withExif: true, withPeople: true, size: 1000, page })
    });

    const { assets: result } = await response.json() as SearchMetadataResponse;

    assets.push(...result.items);
    page = result.nextPage === null ? null : Number(result.nextPage);
  }

  return assets;
}

export async function getPreview(assetId: string): Promise<{ contentType: string; body: Buffer }> {
  const response = await request(`/assets/${encodeURIComponent(assetId)}/thumbnail?size=preview`);

  return {
    contentType: response.headers.get('content-type') ?? 'image/jpeg',
    body: Buffer.from(await response.arrayBuffer())
  };
}
