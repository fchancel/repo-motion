<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Ajouter un projet"
    description="Indiquez le dossier qui contient le code. Rien n'est analysé tant que vous ne lancez pas l'analyse, et le dossier n'est jamais modifié."
  >
    <ProjectFolderForm autofocus @added="open = false" />
    <div class="actions">
      <UiButton variant="ghost" @click="open = false">Annuler</UiButton>
    </div>
  </UiDialog>
</template>

<style scoped>
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: -0.5rem;
}
</style>
