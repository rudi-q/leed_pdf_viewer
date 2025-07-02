import type { DrawingTool } from '../stores/drawingStore';
import { browser } from '$app/environment';

// Dynamically import Konva only on the client side
let Konva: any = null;

export interface ShapeObject {
  id: string;
  type: 'text' | 'rectangle' | 'circle' | 'arrow';
  pageNumber: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  points?: number[]; // For arrows
  relativeX: number; // 0-1 range for scaling
  relativeY: number; // 0-1 range for scaling
  relativeWidth?: number;
  relativeHeight?: number;
}

export class KonvaShapeEngine {
  private stage: any;
  private layer: any;
  private transformer: any;
  private container: HTMLDivElement;
  private currentTool: DrawingTool | 'text' | 'rectangle' | 'circle' | 'arrow' = 'text';
  private isDrawingShape = false;
  private startPos = { x: 0, y: 0 };
  private currentShape: any = null;
  private isInitialized = false;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.init();
  }

  private async init() {
    if (!browser || this.isInitialized) return;
    
    try {
      // Dynamically import Konva only on client side
      const konvaModule = await import('konva');
      Konva = konvaModule.default;
      
      this.stage = new Konva.Stage({
        container: this.container,
        width: this.container.clientWidth,
        height: this.container.clientHeight
      });

      this.layer = new Konva.Layer();
      this.stage.add(this.layer);

      // Transformer for selecting and manipulating objects
      this.transformer = new Konva.Transformer({
        resizeEnabled: true,
        rotateEnabled: true,
        borderStroke: '#4A90E2',
        borderStrokeWidth: 2,
        borderDash: [3, 3],
        anchorFill: '#4A90E2',
        anchorStroke: '#4A90E2'
      });
      this.layer.add(this.transformer);

      this.setupEventListeners();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Konva:', error);
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  private setupEventListeners() {
    // Only handle events when using shape tools
    // Let pencil/eraser tools pass through to drawing canvas
    
    // Click to handle text placement and object selection
    this.stage.on('click tap', (e) => {
      // Handle text tool first
      if (this.currentTool === 'text' && e.target === this.stage) {
        const pos = this.stage.getPointerPosition();
        if (!pos) return;
        this.addText(pos.x, pos.y);
        return;
      }
      
      // Only handle if we're using shape tools or clicking on existing shapes
      if (['text', 'rectangle', 'circle', 'arrow'].includes(this.currentTool) || e.target !== this.stage) {
        if (e.target === this.stage) {
          // Clicked on empty area - deselect all
          this.transformer.nodes([]);
          return;
        }

        // Skip transformer nodes
        if (e.target === this.transformer || e.target.hasName('_transformer')) {
          return;
        }

        // Select clicked object
        if (e.target !== this.stage) {
          this.transformer.nodes([e.target as any]);
        }
      }
    });

    // Double-click to edit text
    this.stage.on('dblclick dbltap', (e) => {
      if (e.target instanceof Konva.Text) {
        this.editText(e.target);
      }
    });

    // Shape drawing events - only when using shape tools
    this.stage.on('mousedown touchstart', (e) => {
      if (['rectangle', 'circle', 'arrow'].includes(this.currentTool)) {
        this.handleShapeStart(e);
      }
    });
    
    this.stage.on('mousemove touchmove', (e) => {
      if (['rectangle', 'circle', 'arrow'].includes(this.currentTool)) {
        this.handleShapeMove(e);
      }
    });
    
    this.stage.on('mouseup touchend', (e) => {
      if (['rectangle', 'circle', 'arrow'].includes(this.currentTool)) {
        this.handleShapeEnd();
      }
    });
  }

  async setTool(tool: DrawingTool | 'text' | 'rectangle' | 'circle' | 'arrow') {
    await this.ensureInitialized();
    if (!this.isInitialized) return;
    
    this.currentTool = tool;
    
    // Change cursor based on tool
    if (tool === 'text') {
      this.stage.container().style.cursor = 'text';
    } else if (['rectangle', 'circle', 'arrow'].includes(tool)) {
      this.stage.container().style.cursor = 'crosshair';
    } else {
      this.stage.container().style.cursor = 'default';
    }
  }

  private handleShapeStart(e: any) {
    // Only handle shape tools
    if (!['rectangle', 'circle', 'arrow'].includes(this.currentTool)) {
      return;
    }

    // Don't start drawing if clicking on existing object
    if (e.target !== this.stage) {
      return;
    }

    this.isDrawingShape = true;
    const pos = this.stage.getPointerPosition();
    if (!pos) return;

    this.startPos = pos;
    this.currentShape = null;

    // Create shape based on current tool
    switch (this.currentTool) {
      case 'rectangle':
        this.currentShape = new Konva.Rect({
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          stroke: '#2D3748',
          strokeWidth: 2,
          fill: 'transparent',
          draggable: true
        });
        break;
      case 'circle':
        this.currentShape = new Konva.Circle({
          x: pos.x,
          y: pos.y,
          radius: 0,
          stroke: '#2D3748',
          strokeWidth: 2,
          fill: 'transparent',
          draggable: true
        });
        break;
      case 'arrow':
        this.currentShape = new Konva.Arrow({
          points: [pos.x, pos.y, pos.x, pos.y],
          stroke: '#2D3748',
          strokeWidth: 2,
          fill: '#2D3748',
          draggable: true,
          pointerLength: 10,
          pointerWidth: 8
        });
        break;
    }

    if (this.currentShape) {
      this.layer.add(this.currentShape);
    }
  }

  private handleShapeMove(e: any) {
    if (!this.isDrawingShape || !this.currentShape) return;

    const pos = this.stage.getPointerPosition();
    if (!pos) return;

    // Update shape based on type
    if (this.currentShape instanceof Konva.Rect) {
      const width = pos.x - this.startPos.x;
      const height = pos.y - this.startPos.y;
      this.currentShape.width(Math.abs(width));
      this.currentShape.height(Math.abs(height));
      this.currentShape.x(width < 0 ? pos.x : this.startPos.x);
      this.currentShape.y(height < 0 ? pos.y : this.startPos.y);
    } else if (this.currentShape instanceof Konva.Circle) {
      const radius = Math.sqrt(
        Math.pow(pos.x - this.startPos.x, 2) + Math.pow(pos.y - this.startPos.y, 2)
      );
      this.currentShape.radius(radius);
    } else if (this.currentShape instanceof Konva.Arrow) {
      this.currentShape.points([this.startPos.x, this.startPos.y, pos.x, pos.y]);
    }
  }

  private handleShapeEnd() {
    if (!this.isDrawingShape || !this.currentShape) return;

    this.isDrawingShape = false;
    
    // Remove very small shapes (accidental clicks)
    if (this.currentShape instanceof Konva.Rect) {
      if (this.currentShape.width() < 5 || this.currentShape.height() < 5) {
        this.currentShape.destroy();
        return;
      }
    } else if (this.currentShape instanceof Konva.Circle) {
      if (this.currentShape.radius() < 3) {
        this.currentShape.destroy();
        return;
      }
    }

    // Generate unique ID for the shape
    this.currentShape.id(`shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    
    // Trigger save event
    if (this.onShapeAdded) {
      this.onShapeAdded(this.serializeShape(this.currentShape));
    }
    
    this.currentShape = null;
  }

  async addText(x: number, y: number, text: string = '', fontSize: number = 16) {
    await this.ensureInitialized();
    if (!this.isInitialized || !Konva) return;
    
    const textNode = new Konva.Text({
      x,
      y,
      text: text || 'Click to edit', // Placeholder text
      fontSize,
      fontFamily: 'Inter, Arial, sans-serif',
      fill: '#2D3748',
      draggable: true,
      id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    this.layer.add(textNode);
    
    // Auto-select new text for immediate editing
    this.transformer.nodes([textNode]);
    
    // Always auto-edit new text for empty input
    setTimeout(() => this.editText(textNode), 100);

    return textNode;
  }

  private editText(textNode: any) {
    const textPosition = textNode.getAbsolutePosition();
    const stageBox = this.stage.container().getBoundingClientRect();
    
    const input = document.createElement('input');
    input.type = 'text';
    // Start with empty input for new text objects
    input.value = textNode.text() === 'Click to edit' ? '' : textNode.text();
    input.style.position = 'absolute';
    input.style.top = (stageBox.top + textPosition.y) + 'px';
    input.style.left = (stageBox.left + textPosition.x) + 'px';
    input.style.width = Math.max(textNode.width(), 100) + 'px';
    input.style.fontSize = textNode.fontSize() + 'px';
    input.style.fontFamily = textNode.fontFamily();
    input.style.border = '2px solid #4A90E2';
    input.style.background = 'white';
    input.style.outline = 'none';
    input.style.zIndex = '1000';

    document.body.appendChild(input);
    input.focus();
    input.select();
    
    const cleanup = () => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };
    
    const updateText = () => {
      const newText = input.value.trim();
      if (newText === '') {
        // If text is empty, remove the text node
        console.log('Text is empty, removing text node');
        if (this.onShapeDeleted) {
          this.onShapeDeleted(textNode.id());
        }
        textNode.destroy();
        this.transformer.nodes([]);
      } else {
        // Check if this is a new text object (has placeholder text)
        const isNewText = textNode.text() === 'Click to edit';
        
        // Update text
        textNode.text(newText);
        
        // Trigger appropriate save event
        if (isNewText && this.onShapeAdded) {
          // This is a new text object being saved for the first time
          this.onShapeAdded(this.serializeShape(textNode));
        } else if (!isNewText && this.onShapeUpdated) {
          // This is an existing text object being updated
          this.onShapeUpdated(this.serializeShape(textNode));
        }
      }
      cleanup();
    };
    
    const cancelEdit = () => {
      // If this was a new text object (placeholder text), remove it on cancel
      if (textNode.text() === 'Click to edit') {
        console.log('Canceling new text creation');
        textNode.destroy();
        this.transformer.nodes([]);
      }
      cleanup();
    };

    input.addEventListener('blur', updateText);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        updateText();
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    });
  }

  private serializeShape(shape: any): ShapeObject {
    const stageWidth = this.stage.width();
    const stageHeight = this.stage.height();
    
    const baseObject = {
      id: shape.id(),
      pageNumber: 1, // Will be set by parent component
      x: shape.x(),
      y: shape.y(),
      relativeX: shape.x() / stageWidth,
      relativeY: shape.y() / stageHeight
    };

    if (shape instanceof Konva.Text) {
      return {
        ...baseObject,
        type: 'text' as const,
        text: shape.text(),
        fontSize: shape.fontSize(),
        fill: shape.fill()
      };
    } else if (shape instanceof Konva.Rect) {
      return {
        ...baseObject,
        type: 'rectangle' as const,
        width: shape.width(),
        height: shape.height(),
        relativeWidth: shape.width() / stageWidth,
        relativeHeight: shape.height() / stageHeight,
        stroke: shape.stroke(),
        strokeWidth: shape.strokeWidth(),
        fill: shape.fill()
      };
    } else if (shape instanceof Konva.Circle) {
      return {
        ...baseObject,
        type: 'circle' as const,
        width: shape.radius() * 2,
        height: shape.radius() * 2,
        relativeWidth: (shape.radius() * 2) / stageWidth,
        relativeHeight: (shape.radius() * 2) / stageHeight,
        stroke: shape.stroke(),
        strokeWidth: shape.strokeWidth(),
        fill: shape.fill()
      };
    } else if (shape instanceof Konva.Arrow) {
      return {
        ...baseObject,
        type: 'arrow' as const,
        points: shape.points(),
        stroke: shape.stroke(),
        strokeWidth: shape.strokeWidth(),
        fill: shape.fill()
      };
    }

    throw new Error(`Unknown shape type: ${shape.constructor.name}`);
  }

  async loadShapes(shapes: ShapeObject[]) {
    await this.ensureInitialized();
    if (!this.isInitialized || !Konva) return;
    
    // Clear existing shapes
    this.layer.find('.shape, .text').forEach((node: any) => node.destroy());
    
    shapes.forEach(shapeData => {
      let shape: any;
      
      switch (shapeData.type) {
        case 'text':
          shape = new Konva.Text({
            id: shapeData.id,
            x: shapeData.x,
            y: shapeData.y,
            text: shapeData.text || 'Text',
            fontSize: shapeData.fontSize || 16,
            fill: shapeData.fill || '#2D3748',
            fontFamily: 'Inter, Arial, sans-serif',
            draggable: true
          });
          break;
        case 'rectangle':
          shape = new Konva.Rect({
            id: shapeData.id,
            x: shapeData.x,
            y: shapeData.y,
            width: shapeData.width || 100,
            height: shapeData.height || 60,
            stroke: shapeData.stroke || '#2D3748',
            strokeWidth: shapeData.strokeWidth || 2,
            fill: shapeData.fill || 'transparent',
            draggable: true
          });
          break;
        case 'circle':
          shape = new Konva.Circle({
            id: shapeData.id,
            x: shapeData.x,
            y: shapeData.y,
            radius: (shapeData.width || 60) / 2,
            stroke: shapeData.stroke || '#2D3748',
            strokeWidth: shapeData.strokeWidth || 2,
            fill: shapeData.fill || 'transparent',
            draggable: true
          });
          break;
        case 'arrow':
          shape = new Konva.Arrow({
            id: shapeData.id,
            x: shapeData.x,
            y: shapeData.y,
            points: shapeData.points || [0, 0, 50, 50],
            stroke: shapeData.stroke || '#2D3748',
            strokeWidth: shapeData.strokeWidth || 2,
            fill: shapeData.fill || '#2D3748',
            draggable: true,
            pointerLength: 10,
            pointerWidth: 8
          });
          break;
        default:
          return;
      }
      
      this.layer.add(shape);
    });
  }

  async resize(width: number, height: number) {
    await this.ensureInitialized();
    if (!this.isInitialized) return;
    
    this.stage.width(width);
    this.stage.height(height);
  }

  async clear() {
    await this.ensureInitialized();
    if (!this.isInitialized) return;
    
    this.layer.find('.shape, .text').forEach((node: any) => node.destroy());
    this.transformer.nodes([]);
  }

  destroy() {
    this.stage.destroy();
  }

  getStage() {
    return this.stage;
  }

  exportAsCanvas(): HTMLCanvasElement {
    if (!this.isInitialized || !this.stage) {
      throw new Error('Konva stage not initialized');
    }
    return this.stage.toCanvas();
  }

  // Event callbacks - set these from parent component
  onShapeAdded?: (shape: ShapeObject) => void;
  onShapeUpdated?: (shape: ShapeObject) => void;
  onShapeDeleted?: (shapeId: string) => void;
}
