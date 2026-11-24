import React, { useEffect, useRef, useState } from 'react';
import dayjs, { type Dayjs } from '../../dayjs';
import type { KioskPhoto, KioskRandomPhotoApiResponse } from '../../api/types';
import { fetchKiosk } from './api';
import styles from './kiosk.module.css';

const DEFAULT_SLIDE_SECONDS = 15;
const RETRY_SECONDS = 5;

interface LoadedSlide {
  key: number;
  photo: KioskPhoto;
  src: string;
  isPortrait: boolean;
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
  const footer = photo.description ?? takenAt.from(now);

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
  const [slides, setSlides] = useState<LoadedSlide[]>([]);
  const nextKey = useRef(0);
  const skipToNext = useRef(() => {});

  useEffect(() => {
    let cancelled = false;
    let isLoading = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = (seconds: number) => {
      isLoading = false;

      if (!cancelled) {
        timer = setTimeout(showNext, seconds * 1000);
      }
    };

    const showNext = async () => {
      isLoading = true;

      let next: KioskRandomPhotoApiResponse;

      try {
        next = await fetchKiosk<KioskRandomPhotoApiResponse>('/photos/random');
      } catch {
        scheduleNext(RETRY_SECONDS);

        return;
      }

      if (cancelled) {
        return;
      }

      const image = new Image();

      image.onload = () => {
        if (cancelled) {
          return;
        }

        const slide = { key: nextKey.current++, photo: next.photo, src: next.imageDataUrl, isPortrait: image.naturalHeight > image.naturalWidth };

        setSlides((previous) => [...previous.slice(-1), slide]);
        scheduleNext(getSlideSeconds());
      };

      image.onerror = () => scheduleNext(RETRY_SECONDS);

      image.src = next.imageDataUrl;
    };

    skipToNext.current = () => {
      if (!isLoading) {
        clearTimeout(timer);
        showNext();
      }
    };

    showNext();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {slides.map((slide) => <Slide key={slide.key} slide={slide} now={now} />)}
      <button type="button" className={styles.skipArea} aria-label="Next photo" onClick={() => skipToNext.current()} />
    </>
  );
}
