import { addIcon } from "obsidian";

export const sembleLogo = `<svg width="24" height="24" viewBox="0 0 32 43" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M31.0164 33.1306C31.0164 38.581 25.7882 42.9994 15.8607 42.9994C5.93311 42.9994 0 37.5236 0 32.0732C0 26.6228 5.93311 23.2617 15.8607 23.2617C25.7882 23.2617 31.0164 27.6802 31.0164 33.1306Z" fill="#ff6400"></path><path d="M25.7295 19.3862C25.7295 22.5007 20.7964 22.2058 15.1558 22.2058C9.51511 22.2058 4.93445 22.1482 4.93445 19.0337C4.93445 15.9192 9.71537 12.6895 15.356 12.6895C20.9967 12.6895 25.7295 16.2717 25.7295 19.3862Z" fill="#ff6400"></path><path d="M25.0246 10.9256C25.0246 14.0401 20.7964 11.9829 15.1557 11.9829C9.51506 11.9829 6.34424 13.6876 6.34424 10.5731C6.34424 7.45857 9.51506 5.63867 15.1557 5.63867C20.7964 5.63867 25.0246 7.81103 25.0246 10.9256Z" fill="#ff6400"></path><path d="M20.4426 3.5755C20.4426 5.8323 18.2088 4.22951 15.2288 4.22951C12.2489 4.22951 10.5737 5.8323 10.5737 3.5755C10.5737 1.31871 12.2489 0 15.2288 0C18.2088 0 20.4426 1.31871 20.4426 3.5755Z" fill="#ff6400"></path></svg>`;

export const marginLogo = `<svg width="265" height="231" viewBox="0 0 265 231" fill="#027bff" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 230 V0 H199 V65.7156 H149.5 V115.216 H182.5 L199 131.716 V230 Z"/>
  <path d="M215 214.224 V230 H264.5 V0 H215.07 V16.2242 H248.5 V214.224 H215 Z"/>
</svg>
`;

// for guidelines mapped to 100×100: stroke-width=8 (≈2px@24px), ~4px padding, ~8px element spacing.
//
// Original semble paths scaled from viewBox "0 0 32 43" → 100×100 (x×3.125, y×2.326)
const sembleCompat =
	`<path d="M96.9 77.1C96.9 89.8 80.6 100 49.6 100C18.5 100 0 87.3 0 74.6C0 61.9 18.5 54.1 49.6 54.1C80.6 54.1 96.9 61.9 96.9 77.1Z" fill="#ff6400"/>` +
	`<path d="M80.4 45.1C80.4 52.3 65.0 51.7 47.4 51.7C29.7 51.7 15.4 51.5 15.4 44.3C15.4 37.0 30.4 29.5 48.0 29.5C65.6 29.5 80.4 37.0 80.4 45.1Z" fill="#ff6400"/>` +
	`<path d="M78.2 25.4C78.2 32.7 65.0 27.9 47.4 27.9C29.7 27.9 19.8 31.8 19.8 24.6C19.8 17.4 29.7 13.1 47.4 13.1C65.0 13.1 78.2 17.4 78.2 25.4Z" fill="#ff6400"/>` +
	`<path d="M63.9 8.3C63.9 13.6 56.9 9.8 47.6 9.8C38.3 9.8 33.1 13.6 33.1 8.3C33.1 3.1 38.3 0 47.6 0C56.9 0 63.9 3.1 63.9 8.3Z" fill="#ff6400"/>`;

// margin logo scaled to 100×100
const marginCompat =
	`<path d="M12,92 L12,8 L50,8 L50,29 L37,29 L37,50 L42,50 L50,58 L50,92 L12,92" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` +
	`<path d="M67,8 L88,8 L88,92 L67,92" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;

export function registerIcons() {
	addIcon("atmosphere-semble", sembleCompat);
	addIcon("atmosphere-margin", marginCompat);
}
