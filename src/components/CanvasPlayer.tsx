import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function CanvasVideoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const [videoUrl, setVideoUrl] = useState<string>(
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
  );

  const handleFileUpload = () => {
    const inputElement = document.createElement("input");
    inputElement.accept = ".mp4";
    inputElement.type = "file";
    inputElement.addEventListener("change", (event) => {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
        const file = input.files[0];
        if (file) {
          const newVideoUrl = URL.createObjectURL(file);
          setVideoUrl(newVideoUrl);
          initVideo();
        }
      }
    });
    inputElement.click();
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        cancelAnimationFrame(animationRef.current!);
      } else {
        videoRef.current.play();
        animationRef.current = requestAnimationFrame(renderFrame);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume[0];
      setVolume(newVolume[0]);
      setIsMuted(newVolume[0] === 0);
    }
  };

  const handleSeek = (newProgress: number[]) => {
    console.log(newProgress);
    if (videoRef.current) {
      videoRef.current.currentTime = newProgress[0];
      setCurrentTime(newProgress[0]);
      renderFrame();
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const [customShader, setCustomShader] = useState<string>("");
  const [showCustomShaderInput, setShowCustomShaderInput] = useState(false);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);

  const handleCustomShaderChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setCustomShader(event.target.value);
    renderFrame();
  };

  const applyCustomShader = () => {
    setShowCustomShaderInput(false);
    renderFrame();
  };

  const applyEffect = (effect: string | null) => {
    setActiveEffect(effect);
    let shaderCode = "";

    switch (effect) {
      case "grayscale":
        shaderCode =
          "float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114)); gl_FragColor = vec4(vec3(gray), color.a);";
        break;
      case "sepia":
        shaderCode = `
          vec3 sepia = vec3(
            dot(color.rgb, vec3(0.393, 0.769, 0.189)),
            dot(color.rgb, vec3(0.349, 0.686, 0.168)),
            dot(color.rgb, vec3(0.272, 0.534, 0.131))
          );
          gl_FragColor = vec4(sepia, color.a);
        `;
        break;
      case "blur":
        shaderCode = `
          vec4 sum = vec4(0.0);
          float blurSize = 0.01;
          sum += texture2D(video, vec2(texCoord.x - blurSize, 1.0 - texCoord.y)) * 0.2;
          sum += texture2D(video, vec2(texCoord.x, 1.0 - texCoord.y)) * 0.6;
          sum += texture2D(video, vec2(texCoord.x + blurSize, 1.0 - texCoord.y)) * 0.2;
          gl_FragColor = sum;
        `;
        break;
      case "invert":
        shaderCode = "gl_FragColor = vec4(1.0 - color.rgb, color.a);";
        break;
      default:
        shaderCode = "gl_FragColor = color;";
    }

    setCustomShader(shaderCode);
    renderFrame();
  };

  const renderFrame = () => {
    if (videoRef.current && canvasRef.current) {
      if (
        videoRef.current.currentTime >= videoRef.current.duration &&
        isPlaying
      ) {
        togglePlay();
        cancelAnimationFrame(animationRef.current!);
      }

      const gl = canvasRef.current.getContext("webgl");
      if (gl) {
        // Create vertex shader
        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(
          vertexShader,
          `
          attribute vec2 position;
          varying vec2 texCoord;
          void main() {
            texCoord = position * 0.5 + 0.5;
            gl_Position = vec4(position, 0.0, 1.0);
          }
        `
        );
        gl.compileShader(vertexShader);

        // Create fragment shader
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(
          fragmentShader,
          `
          precision mediump float;
          varying vec2 texCoord;
          uniform sampler2D video;
          void main() {
            vec4 color = texture2D(video, vec2(texCoord.x, 1.0 - texCoord.y));
            ${customShader || "gl_FragColor = color;"}
          }
        `
        );
        gl.compileShader(fragmentShader);

        // Check for shader compilation errors
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
          console.error(
            "Shader compilation error:",
            gl.getShaderInfoLog(fragmentShader)
          );
          return;
        }

        // Create and link program
        const program = gl.createProgram()!;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.useProgram(program);

        // Create vertex buffer
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // Set up attributes and uniforms
        const positionLocation = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Create and set up texture
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Upload video frame to texture
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          videoRef.current
        );

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      animationRef.current = requestAnimationFrame(renderFrame);
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const initVideo = () => {
    if (videoRef.current && canvasRef.current) {
      const videoElement = videoRef.current;
      const canvasElement = canvasRef.current;
      videoElement.load();
      videoElement.addEventListener("loadedmetadata", () => {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        setDuration(videoElement.duration);
        setCurrentTime(0);
        renderFrame();
      });
    }
  };

  useEffect(() => {
    initVideo();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current!);
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col items-center">
        <canvas
          ref={canvasRef}
          onClick={togglePlay}
          className="rounded-lg border-4 border-black"
        />
        <video
          ref={videoRef}
          className="hidden"
          src={videoUrl}
          crossOrigin="anonymous"
        />
        <div className="mt-4 bg-gray-100 p-4 rounded-lg shadow w-1/2">
          <Slider
            className="w-full mb-4"
            value={[currentTime]}
            max={duration}
            step={0.001}
            onValueChange={handleSeek}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="icon" onClick={togglePlay}>
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" size="icon" onClick={toggleMute}>
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                className="w-24"
                value={[volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
              />
              <span className="text-sm text-gray-600">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <Button variant="outline" size="icon" onClick={handleFileUpload}>
                {<Upload />}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <p className="text-gray-600 text-3xl">Effects</p>
      <div className="mt-4 bg-gray-100 p-4 rounded-lg shadow w-full grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className={`p-4 h-auto flex flex-col gap-2 items-center justify-center ${
            activeEffect === "grayscale"
              ? "bg-accent text-accent-foreground"
              : ""
          }`}
          onClick={() => applyEffect("grayscale")}
        >
          <span className="font-semibold">Grayscale</span>
          <span className="text-sm text-gray-500">
            Convert to black and white
          </span>
        </Button>
        <Button
          variant="outline"
          className={`p-4 h-auto flex flex-col gap-2 items-center justify-center ${
            activeEffect === "sepia" ? "bg-accent text-accent-foreground" : ""
          }`}
          onClick={() => applyEffect("sepia")}
        >
          <span className="font-semibold">Sepia</span>
          <span className="text-sm text-gray-500">Add vintage brown tint</span>
        </Button>
        <Button
          variant="outline"
          className={`p-4 h-auto flex flex-col gap-2 items-center justify-center ${
            activeEffect === "blur" ? "bg-accent text-accent-foreground" : ""
          }`}
          onClick={() => applyEffect("blur")}
        >
          <span className="font-semibold">Blur</span>
          <span className="text-sm text-gray-500">Soft focus effect</span>
        </Button>
        <Button
          variant="outline"
          className={`p-4 h-auto flex flex-col gap-2 items-center justify-center ${
            activeEffect === "invert" ? "bg-accent text-accent-foreground" : ""
          }`}
          onClick={() => applyEffect("invert")}
        >
          <span className="font-semibold">Invert</span>
          <span className="text-sm text-gray-500">Reverse all colors</span>
        </Button>
        <Button
          variant="outline"
          className="p-4 h-auto flex flex-col gap-2 items-center justify-center col-span-2 md:col-span-4"
          onClick={() => setShowCustomShaderInput(!showCustomShaderInput)}
        >
          <span className="font-semibold">Custom Shader</span>
          <span className="text-sm text-gray-500">
            Write your own GLSL shader code
          </span>
        </Button>
        {showCustomShaderInput && (
          <div className="col-span-2 md:col-span-4 w-full">
            <textarea
              className="w-full h-32 p-2 border rounded-md font-mono text-sm"
              value={customShader}
              onChange={handleCustomShaderChange}
              placeholder="Enter your GLSL shader code here...
Example: gl_FragColor = vec4(color.r, color.g, color.b, 1.0);"
            />
            <Button className="mt-2" onClick={applyCustomShader}>
              Apply Shader
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
