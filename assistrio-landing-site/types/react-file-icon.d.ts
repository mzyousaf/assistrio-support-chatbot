declare module "react-file-icon" {
  import type { FC, SVGProps } from "react";

  export type FileIconGlyph =
    | "3d"
    | "acrobat"
    | "android"
    | "audio"
    | "binary"
    | "code"
    | "code2"
    | "compressed"
    | "document"
    | "drive"
    | "font"
    | "image"
    | "presentation"
    | "settings"
    | "spreadsheet"
    | "vector"
    | "video";

  export type FileIconProps = {
    color?: string;
    extension?: string;
    fold?: boolean;
    foldColor?: string;
    glyphColor?: string;
    gradientColor?: string;
    gradientOpacity?: number;
    labelColor?: string;
    labelTextColor?: string;
    labelUppercase?: boolean;
    radius?: number;
    type?: FileIconGlyph;
  } & SVGProps<SVGSVGElement>;

  export const FileIcon: FC<FileIconProps>;

  export const defaultStyles: Record<string, Partial<FileIconProps>>;
}
