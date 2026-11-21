export interface PacketBlockData {
  id: string;
  bits: number;
  label: string;
}

export interface PacketDiagramData {
  diagramType: 'packet';
  title?: string;
  bitsPerRow?: number;
  showBits?: boolean;
  blocks: PacketBlockData[];
  comments?: string[];
}
