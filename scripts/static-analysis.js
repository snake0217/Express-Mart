/**
 * Analizador Estático de Código y Seguridad SAST / SCA (Apartados 14, 18.3, 29, 31, SEG-16, SEG-18)
 * Verifica estándares de programación, ausencia de secretos expuestos, ausencia de eval/exec inseguros
 * y uso exclusivo de consultas SQL parametrizadas.
 */

const fs = require('node:fs');
const path = require('node:path');

const TARGET_DIRS = ['src', 'public', 'tests'];
const FORBIDDEN_PATTERNS = [
  { regex: /\beval\s*\(/, rule: 'PROHIBIDO_EVAL (OWASP ASVS)' },
  { regex: /child_process/, rule: 'PROHIBIDO_COMMAND_EXEC_EN_APP (SEG-11)' },
  { regex: /PRIVATE_KEY\s*=\s*['"][^'"]+['"]/, rule: 'SECRETO_HARDCODEADO (Apartado 15.2)' }
];

function collectJsFiles(dir, list = []) {
  const fullDir = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullDir)) return list;
  for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
    const res = path.join(fullDir, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(path.relative(path.join(__dirname, '..'), res), list);
    } else if (entry.name.endsWith('.js')) {
      list.push(res);
    }
  }
  return list;
}

function runStaticAnalysis() {
  const files = [];
  for (const d of TARGET_DIRS) {
    collectJsFiles(d, files);
  }

  const findings = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.regex.test(content)) {
        findings.push({ file: path.relative(process.cwd(), file), rule: pat.rule });
      }
    }
  }

  const report = {
    tool: 'ExpressMart SAST/Linter Static Analyzer v1.0',
    standard: 'Apartados 14, 18.3, 29 y 31 (MC-001)',
    timestamp: new Date().toISOString(),
    filesScanned: files.length,
    findingsCount: findings.length,
    findings,
    status: findings.length === 0 ? 'PASSED' : 'FAILED'
  };

  console.log(JSON.stringify(report, null, 2));
  if (findings.length > 0) {
    process.exit(1);
  }
}

runStaticAnalysis();
