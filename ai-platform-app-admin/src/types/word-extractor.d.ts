declare module "word-extractor" {
  class ExtractedWordDocument {
    getBody(): string;
  }

  export default class WordExtractor {
    extract(filePath: string): Promise<ExtractedWordDocument>;
  }
}
