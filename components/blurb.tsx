import { Box, Card, CardContent, Stack } from "@mui/material";
import { useEffect, useState } from "react";

import { FirebaseWrapper } from "../lib/firebase/firebaseWrapper";
import Plagiarism from "./plagiarism";
import { onValue } from "firebase/database";

interface Props {
  generatingPost: string;
  blurbsFinishedGenerating: boolean;
}

type ScanResponse = {
  scanId: string;
};

export default function Blurb({
  generatingPost,
  blurbsFinishedGenerating,
}: Props) {
  const [plagiarismLoading, setPlagiarismLoading] = useState<boolean>(false);
  const [plagiarisedScore, setPlagiarisedScore] = useState<number>(0);
  const [highlightedHTMLBlurb, setHighlightedHTMLBlurb] =
    useState<JSX.Element>();

  const checkPlagiarism = async (streamedBlurb: string) => {
    setPlagiarismLoading(true);
    const scanResponse = await fetch("/api/plagiarismCheck", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: streamedBlurb,
      }),
    });
    const scanId = ((await scanResponse.json()) as ScanResponse).scanId;
    const firebase = new FirebaseWrapper();
    const scanRef = firebase.getScanReference(scanId);

    onValue(scanRef, async (scanRecord: any) => {
      // Only continue if a <scanId> node is present in Firebase
      if (scanRecord.exists()) {
        const scan = scanRecord.val();
        handleScan(streamedBlurb, scan);
      }
    });
  };

  function getHighlightedHTMLBlurb(
    text: string,
    characterStarts: number[],
    characterLengths: number[]
  ) {
    let characterStartsIndex = 0;
    let highlightedHTMLBlurb = "";
    for (let i = 0; i < text.length; i++) {
      if (i == characterStarts[characterStartsIndex]) {
        const segmentStart = characterStarts[characterStartsIndex];
        const segmentEnd =
          characterStarts[characterStartsIndex] +
          characterLengths[characterStartsIndex];

        highlightedHTMLBlurb += `<mark style="background:#FF9890">${text.substring(
          segmentStart,
          segmentEnd
        )}</mark>`;

        i = segmentEnd - 1;
        characterStartsIndex = characterStartsIndex + 1;
      } else {
        highlightedHTMLBlurb += text[i];
      }
    }
    return (
      <Box dangerouslySetInnerHTML={{ __html: highlightedHTMLBlurb }}></Box>
    );
  }

  function handleScan(text: string, scan: any) {
    const totalBlurbWords = text.split(" ").length;
    const matchedWords = scan.matchedWords;
    setPlagiarisedScore((matchedWords / totalBlurbWords) * 100);
    if (matchedWords == 0) {
      setPlagiarismLoading(false);
    } else if (scan.results) {
      const characterStarts = scan.results.identical.source.chars.starts;
      const characterLengths = scan.results.identical.source.chars.lengths;
      const highlightedHTMLBlurb = getHighlightedHTMLBlurb(
        text,
        characterStarts,
        characterLengths
      );
      setHighlightedHTMLBlurb(highlightedHTMLBlurb);
      setPlagiarismLoading(false);
    }
  }

  useEffect(() => {
    if (blurbsFinishedGenerating) {
      checkPlagiarism(generatingPost);
      setHighlightedHTMLBlurb(<>{generatingPost}</>);
    }
  }, [blurbsFinishedGenerating]);

  return (
    <>
      <Stack direction="row" spacing="1em">
        <Card sx={{ width: "37em" }}>
          <CardContent>
            {!blurbsFinishedGenerating ? generatingPost : highlightedHTMLBlurb}
          </CardContent>
        </Card>
        <Stack
          alignItems="center"
          justifyContent="center"
          width="12em"
          className="bg-white rounded-xl shadow-md p-4 border"
        >
          <Plagiarism loading={plagiarismLoading} score={plagiarisedScore} />
        </Stack>
      </Stack>
    </>
  );
}
