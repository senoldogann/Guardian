"use client";

import { getDictionary } from "../../lib/i18n";
import { DownloadPageView } from "../../components/download-page-view";
import type { GithubAsset } from "../../lib/github";

type Props = {
    assets: GithubAsset[];
    latestTag: string;
};

export function ClientPageWrapper({ assets, latestTag }: Props) {
    const dict = getDictionary();

    return <DownloadPageView dict={dict} assets={assets} latestTag={latestTag} />;
}

