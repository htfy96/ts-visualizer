import * as React from "react";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";

import Typography from "@mui/material/Typography"; // Import Typography component
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Editor from "@monaco-editor/react";
import { useDebounce, useAsync, useEffectOnce } from "react-use";
import Button from "@mui/material/Button";
import { Buffer } from "buffer";
import Snackbar from "@mui/material/Snackbar";
import IconButton from "@mui/material/IconButton";
import GithubIcon from "@mui/icons-material/GitHub";

import Parser from "web-tree-sitter";

import * as d3 from "d3";

await Parser.init({
  locateFile(scriptName, scriptDirectory) {
    return scriptName;
  },
});
const parser = new Parser();

const SUPPORTED_LANGUAGES = [
  "ada",
  "agda",
  "arduino",
  "asm",
  "astro",
  "bash",
  "beancount",
  "bibtex",
  "clojure",
  "cmake",
  "comment",
  "commonlisp",
  "cpp",
  "c_sharp",
  "css",
  "c",
  "dart",
  "dockerfile",
  "doxygen",
  "elisp",
  "elixir",
  "elm",
  "fish",
  "fortran",
  "gitattributes",
  "gitignore",
  "git_rebase",
  "gleam",
  "glsl",
  "go",
  "gpr",
  "haskell",
  "haxe",
  "hcl",
  "heex",
  "hlsl",
  "html",
  "jai",
  "janet_simple",
  "javascript",
  "java",
  "jsdoc",
  "jsonnet",
  "json",
  "julia",
  "kotlin",
  "llvm_mir",
  "lua",
  "magik",
  "make",
  "matlab",
  "mermaid",
  "meson",
  "ninja",
  "nix",
  "noir",
  "pascal",
  "php",
  "prisma",
  "purescript",
  "python",
  "racket",
  "regex",
  "rst",
  "ruby",
  "rust",
  "r",
  "scala",
  "scheme",
  "smithy",
  "solidity",
  "svelte",
  "tablegen",
  "tcl",
  "toml",
  "tsx",
  "twig",
  "typescript",
  "verilog",
  "vhdl",
  "xml",
  "zig",
];

function convertTreeNodeIntoGraphJSON(node) {
  if (!node) {
    return {};
  }
  const json = {
    type: node.type,
    children: [],
  };

  for (let i = 0; i < node.childCount; i++) {
    const childJSON = convertTreeNodeIntoGraphJSON(node.child(i));
    if (node.fieldNameForChild(i)) {
      childJSON["parentLinkName"] = node.fieldNameForChild(i);
    }
    json.children.push(childJSON);
  }

  json.text = node.text;

  json.id = `${node.type}!${node.startIndex * 1000000 + node.endIndex}`;

  if (node.isError) {
    json["startPosition"] = node.startPosition;
    json["endPosition"] = node.endPosition;
    json["error"] = true;
  }
  return json;
}

function convertTreeNodeIntoHierarchy(node) {
  const data = convertTreeNodeIntoGraphJSON(node);
  return d3.hierarchy(data);
}

/**
 *
 * @param {d3.hierarchy} hierarchy
 * @param {number} width
 * @param {number} height
 */
function getTree(hierarchy, width, height) {
  const tree = d3.tree();
  tree.size([width, height]);
  tree.nodeSize([190, 90]);
  const plottedTree = tree(hierarchy);
  for (const node of plottedTree.descendants()) {
    node.x = node.x + width / 2;
    node.y = node.y + height / 2;
  }
  return plottedTree;
}

function createLink(s, d) {
  const sx = s.x + 90;
  const sy = s.y + 50;
  const dx = d.x + 90;
  const dy = d.y;
  return (
    <g key={`${s.data.id}+${d.data.id}`}>
      <path
        d={`M ${sx} ${sy}
  C ${(sx + dx) / 2} ${sy},
    ${(sx + dx) / 2} ${dy},
    ${dx} ${dy}`}
        style={{ fill: "none", stroke: "#ccc", strokeWidth: "2px" }}
        key={`${s.data.id}+${d.data.id}Link`}
      />
      {d.data.parentLinkName ? (
        <text
          x={(sx + dx) / 2}
          y={(sy + dy) / 2}
          textAnchor="center"
          fill="#777"
          key={`${d.data.id} parentLinkLabel`}
          textRendering="optimizeSpeed"
        >
          {d.data.parentLinkName}
        </text>
      ) : (
        []
      )}
    </g>
  );
}

/**
 *
 * @param {d3.TreeLayout} tree
 * @param {number} width
 * @param {nuumber} height
 * @returns {React.ReactSVG}
 */
function SVGComp({ tree, width, height }) {
  const ref = React.useRef();
  const [k, setK] = React.useState(1);
  const [x, setX] = React.useState(0);
  const [y, setY] = React.useState(0);

  const [debouncedK, setDebouncedK] = React.useState(1);
  const [debouncedX, setDebouncedX] = React.useState(0);
  const [debouncedY, setDebouncedY] = React.useState(0);
  useDebounce(
    () => {
      setDebouncedK(k);
      setDebouncedX(x);
      setDebouncedY(y);
    },
    0,
    [x, y, k]
  );
  React.useEffect(() => {
    const zoom = d3.zoom().on("zoom", (event) => {
      const { x, y, k } = event.transform;
      setK(k);
      setX(x);
      setY(y);
    });
    d3.select(ref.current).call(zoom);
  }, []);

  function truncateText(text, maxLength) {
    if (text.length > maxLength) {
      return `${text.slice(0, maxLength - 3)}...`;
    }
    return text;
  }
  return (
    <svg width={width} height={height} ref={ref}>
      <g
        transform={`translate(${debouncedX},${debouncedY})scale(${debouncedK})`}
        fontWeight="300"
        key="svg-base-mov"
      >
        {tree.descendants().map((node) => (
          <g key={node.data.id}>
            <rect
              key={`${node.data.id}-rect`}
              x={node.x}
              y={node.y}
              width="180"
              height="50"
              fill={node.data.error ? "lightsalmon" : "lightblue"}
              fillOpacity="0.5"
            />

            {node.links().map((link) => createLink(link.source, link.target))}
            <text
              x={node.x}
              y={node.y}
              dx="0.5rem"
              dy="0.5rem"
              dominantBaseline="hanging"
              textRendering="optimizeSpeed"
              fontFamily="Arial, Helvetica, sans-serif"
              key={`${node.data.id}-label`}
            >
              {node.data.type}
            </text>
            {node.data.text ? (
              <text
                x={node.x}
                y={node.y}
                dy="1.8rem"
                dx="0.5rem"
                fontSize="12"
                fontFamily="monospace"
                dominantBaseline="hanging"
                textRendering="optimizeSpeed"
                key={`${node.data.id}-text`}
              >
                {truncateText(node.data.text, 18)}
              </text>
            ) : (
              []
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}

function convertTreeNodeToJSON(node, terse = false) {
  const json = {
    type: node.type,
    children: {},
  };

  for (var i = 0; i < node.childCount; i++) {
    let fieldName = node.fieldNameForChild(i) || `child_${i}`;
    if (terse && node.fieldNameForChild(i)) {
      fieldName = `child_${i}_${node.fieldNameForChild(i)}`;
    }
    json.children[fieldName] = convertTreeNodeToJSON(node.child(i), terse);
  }

  if (
    terse ||
    node.text.length < 60 ||
    (node.type === "comment" && node.text.length < 80)
  ) {
    json.text = node.text;
  }

  if (!terse && node.childCount === 0) {
    delete json["children"];
  }

  if (terse) {
    json["isError"] = node.isError;
    json["startPosition"] = node.startPosition;
    json["endPosition"] = node.endPosition;
  } else {
    if (node.isError) {
      json["error"] = true;
    }
  }

  return json;
}

const cached_langs = {};
async function getLanguage(language) {
  if (cached_langs[language]) {
    return cached_langs[language];
  }
  const lang = await Parser.Language.load(`tree-sitter-${language}.wasm`);
  cached_langs[language] = lang;
  return lang;
}

function CodeEditor({
  language,
  onChange = undefined,
  options = {},
  onMount = () => {},
}) {
  return (
    <Editor
      height="100%"
      defaultLanguage={language}
      value={`// Sample code\nconst hello = "Hello, World!";\nconsole.log(hello);`}
      theme="vs-dark"
      options={{
        minimap: { enabled: true },
        language: { language },
        ...options,
      }}
      onChange={onChange}
      onMount={onMount}
    />
  );
}

export default function App() {
  const [sourceEditor, setSourceEditor] = React.useState(null);

  const [treeViewerWidth, setTreeViewerWidth] = React.useState(800);
  const [treeViewerHeight, setTreeViewerHeight] = React.useState(600);
  const [resultEditor, setResultEditor] = React.useState(null);
  const [monaco, setMonaco] = React.useState(null);

  const [activeLang, setActiveLang] = React.useState("javascript");

  const [code, setCode] = React.useState(
    `// Sample code\nconst hello = "Hello, World!";\nconsole.log(hello);`
  );
  const [debouncedCode, setDebouncedCode] = React.useState("");

  const plotDiv = React.useRef();

  const [copyNotificationOpen, setCopyNotificationOpen] = React.useState(false);
  const [copyNotifcationMsg, setCopyNotifcationMsg] = React.useState("");

  const [terse, setTerse] = React.useState(false);
  useDebounce(
    () => {
      setDebouncedCode(code);
    },
    500,
    [code, activeLang]
  );

  const computedTree = useAsync(async () => {
    console.log("Parsing");
    const lang = await getLanguage(activeLang);
    parser.setLanguage(lang);
    const tree = parser.parse(debouncedCode);
    console.log(tree);
    return tree;
  }, [debouncedCode, activeLang]);

  const computedTreeStr = React.useMemo(() => {
    if (plotDiv.current) {
      setTreeViewerWidth(plotDiv.current.clientWidth);
      setTreeViewerHeight(plotDiv.current.clientHeight);
    }
    return !computedTree.loading
      ? JSON.stringify(
          convertTreeNodeToJSON(computedTree.value.rootNode, terse),
          null,
          2
        )
      : "N/A";
  }, [computedTree, terse]);

  React.useEffect(() => {
    if (resultEditor) {
      resultEditor.getModel().setValue(computedTreeStr);
    }
  }, [computedTreeStr, resultEditor]);

  React.useEffect(() => {
    if (monaco && sourceEditor) {
      monaco.editor.setModelLanguage(sourceEditor.getModel(), activeLang);
    }
  }, [monaco, activeLang, sourceEditor]);

  React.useEffect(() => {
    if (plotDiv.current) {
      setTreeViewerWidth(plotDiv.current.clientWidth);

      setTreeViewerHeight(plotDiv.current.clientHeight);
    }
  }, [plotDiv]);

  /**
   * Combine multiple Uint8Arrays into one.
   *
   * @param {ReadonlyArray<Uint8Array>} uint8arrays
   * @returns {Promise<Uint8Array>}
   */
  async function concatUint8Arrays(uint8arrays) {
    const blob = new Blob(uint8arrays);
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }
  /**
   * Convert a string to its UTF-8 bytes and compress it.
   *
   * @param {string} str
   * @returns {Promise<Uint8Array>}
   */
  async function compress(str) {
    // Convert the string to a byte stream.
    const stream = new Blob([str]).stream();

    // Create a compressed stream.
    const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));

    // Read all the bytes from this stream.
    const chunks = [];
    for await (const chunk of compressedStream) {
      chunks.push(chunk);
    }
    return await concatUint8Arrays(chunks);
  }

  /**
   * Decompress bytes into a UTF-8 string.
   *
   * @param {Uint8Array} compressedBytes
   * @returns {Promise<string>}
   */
  async function decompress(compressedBytes) {
    // Convert the bytes to a stream.
    const stream = new Blob([compressedBytes]).stream();

    // Create a decompressed stream.
    const decompressedStream = stream.pipeThrough(
      new DecompressionStream("gzip")
    );

    // Read all the bytes from this stream.
    const chunks = [];
    for await (const chunk of decompressedStream) {
      chunks.push(chunk);
    }
    const stringBytes = await concatUint8Arrays(chunks);

    // Convert the bytes to a string.
    return new TextDecoder().decode(stringBytes);
  }

  async function shareLink() {
    const config = {
      language: activeLang,
      code: code,
      terse: terse,
    };
    const compressedConfig = await compress(JSON.stringify(config));
    const base64CompressedConfig =
      Buffer.from(compressedConfig).toString("base64");
    const url = `${window.location.protocol}//${window.location.host}${window.location.pathname}#${base64CompressedConfig}`;
    try {
      if (url.length > 2030) {
        throw new Error("Link is too long to share!");
      }
      await navigator.clipboard.writeText(url);
      setCopyNotificationOpen(true);
      setCopyNotifcationMsg("Link copied to clipboard!");
    } catch (error) {
      setCopyNotifcationMsg(
        `Failed to copy link to clipboard!: ${error.message}`
      );
      setCopyNotificationOpen(true);
    }
  }

  const [providedSourceCode, setProvidedSourceCode] = React.useState(null);
  async function tryLoadConfig() {
    if (!window.location.hash) {
      return;
    }
    try {
      const base64CompressedConfig = window.location.hash.slice(1);
      const compressedConfig = Buffer.from(base64CompressedConfig, "base64");
      const config = JSON.parse(await decompress(compressedConfig));
      setActiveLang(config.language);
      setProvidedSourceCode(config.code);
      setTerse(config.terse);
    } catch (error) {
      console.error("Error loading config:", error);
    }
  }

  useEffectOnce(() => {
    tryLoadConfig();
  }, []);

  React.useEffect(() => {
    if (sourceEditor && providedSourceCode) {
      console.log("Setting provided source code");
      sourceEditor.getModel().setValue(providedSourceCode);
    }
  }, [sourceEditor, providedSourceCode]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Snackbar
        open={copyNotificationOpen}
        autoHideDuration={5000}
        onClose={() => setCopyNotificationOpen(false)}
        message={copyNotifcationMsg}
      />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="h1">
            TreeSitter Visualizer
          </Typography>
          <IconButton
            href="https://github.com/htfy96/ts-visualizer"
            target="_blank"
            rel="noreferrer"
            sx={{
              ml: "auto",
              color: "white",
            }}
          >
            <GithubIcon></GithubIcon>
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box
        component="div"
        sx={{
          p: 2,
          backgroundColor: "#eee",
          borderRadius: 1,
          lineHeight: 2,
        }}
      >
        <FormControl
          sx={{
            display: "flex",
            flexDirection: "row",
            "> *": {
              ml: 2,
            },
          }}
        >
          <InputLabel>Language</InputLabel>
          <Select
            value={activeLang}
            label="Language"
            onChange={(e) => {
              console.log("Language changed:", e.target.value);
              setActiveLang(e.target.value);
            }}
            autoWidth
            sx={{
              mr: 2,
              minWidth: "12rem",
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <MenuItem key={lang} value={lang}>
                {lang}
              </MenuItem>
            ))}
          </Select>
          <FormControlLabel
            control={<Checkbox />}
            label="Machine-friendly JSON"
            value={terse}
            onChange={(_, checked) => setTerse(checked)}
          />
          <Button
            onClick={async () => {
              await shareLink();
            }}
            sx={{
              ml: "auto",
            }}
          >
            Share
          </Button>
        </FormControl>
      </Box>
      <Box
        component="section"
        sx={{
          backgroundColor: "#f5f5f5",
          flexGrow: 1,
        }}
      >
        <PanelGroup autoSaveId="ts-main-divider" direction="horizontal">
          <Panel defaultSize={40}>
            <CodeEditor
              language={activeLang}
              onChange={(v, e) => {
                setCode(v);
              }}
              onMount={(editor, monaco) => {
                setSourceEditor(editor);
                setMonaco(monaco);
              }}
            />
          </Panel>
          <PanelResizeHandle
            style={{
              width: "6px",
              backgroundColor: "#ccc",
              borderRadius: "10px",
            }}
          />
          <Panel defaultSize={30}>
            <CodeEditor
              language="json"
              options={{
                readOnly: true,
                wordWrap: "on",
              }}
              onMount={(editor) => {
                setResultEditor(editor);
              }}
            />
          </Panel>
          <PanelResizeHandle
            style={{
              width: "6px",
              backgroundColor: "#ccc",
              borderRadius: "10px",
            }}
          />
          <Panel
            defaultSize={30}
            onResize={() => {
              setTreeViewerWidth(plotDiv.current.clientWidth);
            }}
          >
            <Box
              ref={plotDiv}
              sx={{
                height: "100%",
                width: "100%",
                backgroundColor: "white",
                cursor: "grabbing",
              }}
            >
              {computedTree.loading && computedTree.value ? (
                <div>Loading...</div>
              ) : (
                <SVGComp
                  tree={getTree(
                    convertTreeNodeIntoHierarchy(
                      computedTree.value ? computedTree.value.rootNode : null
                    ),
                    treeViewerWidth,
                    treeViewerHeight
                  )}
                  width={treeViewerWidth}
                  height={treeViewerHeight}
                />
              )}
            </Box>
          </Panel>
        </PanelGroup>
      </Box>
    </Box>
  );
}
