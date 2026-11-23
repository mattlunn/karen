import { toKioskPhoto } from './kiosk-photo';

describe('toKioskPhoto', () => {
  it('keeps the local wall-clock time, dropping the misleading Z suffix', () => {
    const photo = toKioskPhoto({ id: 'a', localDateTime: '2026-04-04T08:52:10.123Z' }, 'Holiday', []);

    expect(photo.takenAtLocal).toBe('2026-04-04T08:52:10');
  });

  it('lists the first names of the named people, sorted and without duplicates', () => {
    const photo = toKioskPhoto({
      id: 'a',
      localDateTime: '2026-04-04T08:52:10.000Z',
      people: [{ name: 'Zara Smith' }, { name: '' }, { name: 'Alex Smith' }, { name: 'Alex Jones' }]
    }, 'Holiday', []);

    expect(photo.people).toEqual(['Alex', 'Zara']);
  });

  it('leaves out the hidden people', () => {
    const photo = toKioskPhoto({
      id: 'a',
      localDateTime: '2026-04-04T08:52:10.000Z',
      people: [{ name: 'Zara Smith' }, { name: 'Alex Smith' }]
    }, 'Holiday', ['Alex Smith']);

    expect(photo.people).toEqual(['Zara']);
  });

  it('treats a blank description as no description', () => {
    const photo = toKioskPhoto({
      id: 'a',
      localDateTime: '2026-04-04T08:52:10.000Z',
      exifInfo: { city: 'Springfield', description: '' }
    }, 'Holiday', []);

    expect(photo.description).toBeNull();
    expect(photo.city).toBe('Springfield');
  });

  it('copes with an asset that has no people or EXIF data', () => {
    const photo = toKioskPhoto({ id: 'a', localDateTime: '2026-04-04T08:52:10.000Z', exifInfo: null }, 'Holiday', []);

    expect(photo).toEqual({ id: 'a', takenAtLocal: '2026-04-04T08:52:10', people: [], city: null, description: null, albumName: 'Holiday' });
  });
});
