import { createApplication, loadConfig, type Application } from '@repo-motion/infrastructure'

let application: Promise<Application> | null = null

/** Composition root of the web app, built once per server process on first use. */
export const useApplication = (): Promise<Application> => {
  application ??= createApplication(loadConfig())
  return application
}

export const useCases = async () => (await useApplication()).useCases
