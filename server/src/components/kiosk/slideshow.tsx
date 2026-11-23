import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from '../../dayjs';
import { formatTimeAgo } from '../../helpers/time-ago';
import type { KioskPhoto, KioskPhotosApiResponse } from '../../api/types';
import { fetchKiosk, kioskUrl } from './api';
import styles from './kiosk.module.css';

const DEFAULT_SLIDE_SECONDS = 15;
const PHOTO_LIST_REFRESH_MINUTES = 60;

interface LoadedSlide {
  key: number;
  photo: KioskPhoto;
  src: string;
  isPortrait: boolean;
}

function shuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function getSlideSeconds(): number {
  const requested = Number(new URLSearchParams(window.location.search).get('slideSeconds'));

  return requested > 0 ? requested : DEFAULT_SLIDE_SECONDS;
}

function formatPeople(people: string[]): string | null {
  if (people.length === 0) {
    return null;
  }

  if (people.length === 1) {
    return people[0];
  }

  return `${people.slice(0, -1).join(', ')} & ${people[people.length - 1]}`;
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function Slide({ slide, now }: { slide: LoadedSlide; now: Dayjs }) {
  const { photo } = slide;
  const takenAt = dayjs.tz(photo.takenAtLocal, 'Europe/London');
  const people = formatPeople(photo.people);
  const date = takenAt.format('dddd D MMMM YYYY');
  const headline = people ?? date;
  const footer = photo.description ?? formatTimeAgo(takenAt, now);

  if (slide.isPortrait) {
    return (
      <div className={styles.slide}>
        <div className={styles.panelLayout}>
          <div className={styles.panelPhoto}>
            <img className={styles.cover} src={slide.src} alt="" />
          </div>
          <div className={styles.panelSide}>
            <img className={styles.panelBlur} src={slide.src} alt="" />
            <div className={styles.panelBody}>
              <div className={styles.panelAlbum}>{photo.albumName}</div>
              <div className={styles.panelInfo}>
                <div className={styles.panelHeadline}>{headline}</div>
                {people !== null && <div className={styles.panelDetail}>{date}</div>}
                {photo.city !== null && <div className={styles.panelPlace}><PinIcon /><span>{photo.city}</span></div>}
              </div>
              <div className={styles.panelFooter}>{footer}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.slide}>
      <img className={styles.cover} src={slide.src} alt="" />
      <div className={styles.shade} />
      <div className={styles.caption}>
        <div className={styles.captionAlbum}>{photo.albumName}</div>
        <div className={styles.captionHeadline}>{headline}</div>
        <div className={styles.captionDetail}>{[people !== null ? date : null, photo.city].filter(Boolean).join('  ·  ')}</div>
      </div>
      <div className={styles.captionFooter}>{footer}</div>
    </div>
  );
}

export default function Slideshow({ now }: { now: Dayjs }) {
  const { data } = useQuery({
    queryKey: ['kiosk-photos'],
    queryFn: () => fetchKiosk<KioskPhotosApiResponse>('/photos'),
    refetchInterval: PHOTO_LIST_REFRESH_MINUTES * 60 * 1000
  });

  const [slides, setSlides] = useState<LoadedSlide[]>([]);
  const nextKey = useRef(0);

  useEffect(() => {
    if (data === undefined || data.photos.length === 0) {
      return;
    }

    let queue: KioskPhoto[] = [];
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const showNext = () => {
      if (queue.length === 0) {
        queue = shuffle(data.photos);
      }

      const photo = queue.shift()!;
      const image = new Image();

      image.onload = () => {
        if (cancelled) {
          return;
        }

        const slide = { key: nextKey.current++, photo, src: image.src, isPortrait: image.naturalHeight > image.naturalWidth };

        setSlides((previous) => [...previous.slice(-1), slide]);
        timer = setTimeout(showNext, getSlideSeconds() * 1000);
      };

      image.onerror = () => {
        if (!cancelled) {
          timer = setTimeout(showNext, 1000);
        }
      };

      image.src = kioskUrl(`/photos/${photo.id}.jpg`);
    };

    showNext();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data]);

  return (
    <>
      {slides.map((slide) => <Slide key={slide.key} slide={slide} now={now} />)}
    </>
  );
}
