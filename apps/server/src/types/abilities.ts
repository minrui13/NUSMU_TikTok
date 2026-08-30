export type Ability =
  // Allows Agent to inspect files in its workspace
  | "canReadWorkspace"
  // Allows Agent to create, edit or delete workspace files
  | "canWriteWorkspace"
  // Allows Agent to execute shell commands such as tests, builds or package installation
  | "canRunCommand"
  // Allows Agent to read sensitive values such as API keys, tokens, passwords, or .env files
  | "canAccessSecrets"
  // Allows Agent to access the internet or external services.
  | "canUseNetwork"
  // Allows Agent to join session
  | "canJoinSession";

  
export type Risk = "low" | "medium" | "high" | "critical";
