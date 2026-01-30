import type { Client } from "@atcute/client";
import { getProfile } from "../lib";

export interface ProfileData {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
}

export async function fetchProfileData(client: Client, actor: string): Promise<ProfileData | null> {
	try {
		const resp = await getProfile(client, actor);
		if (!resp.ok) return null;

		return {
			did: resp.data.did,
			handle: resp.data.handle,
			displayName: resp.data.displayName,
			avatar: resp.data.avatar,
		};
	} catch (e) {
		console.error("Failed to fetch profile:", e);
		return null;
	}
}

export function renderProfileIcon(
	container: HTMLElement,
	profile: ProfileData | null,
	onClick?: () => void
): HTMLElement {
	const wrapper = container.createEl("div", { cls: "atmark-profile-icon" });

	if (!profile) {
		// Fallback when no profile data
		const placeholder = wrapper.createEl("div", { cls: "atmark-avatar-placeholder" });
		placeholder.createEl("span", { text: "?" });
		return wrapper;
	}

	const avatarBtn = wrapper.createEl("button", { cls: "atmark-avatar-btn" });

	if (profile.avatar) {
		const img = avatarBtn.createEl("img", { cls: "atmark-avatar-img" });
		img.src = profile.avatar;
		img.alt = profile.displayName || profile.handle;
	} else {
		// Fallback initials
		const initials = (profile.displayName || profile.handle)
			.split(" ")
			.map(w => w[0])
			.slice(0, 2)
			.join("")
			.toUpperCase();
		avatarBtn.createEl("span", { text: initials, cls: "atmark-avatar-initials" });
	}

	const info = wrapper.createEl("div", { cls: "atmark-profile-info" });

	if (profile.displayName) {
		info.createEl("span", { text: profile.displayName, cls: "atmark-profile-name" });
	}

	info.createEl("span", { text: `@${profile.handle}`, cls: "atmark-profile-handle" });

	if (onClick) {
		avatarBtn.addEventListener("click", onClick);
	}

	return wrapper;
}
