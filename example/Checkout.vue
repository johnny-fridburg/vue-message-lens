<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n({ useScope: 'local' })
</script>
<template>
  <h1>{{ t('hello') }}</h1>
</template>
<i18n lang="json" src="./Checkout.i18n.json" />
