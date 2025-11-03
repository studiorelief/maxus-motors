export function hideDynListIfEmpty() {
  // Find all dynamic lists with if-empty="hide" attribute
  const dynLists = document.querySelectorAll('.w-dyn-list[if-empty="hide"]');

  dynLists.forEach((list) => {
    // Check if list has empty state
    const isEmpty = list.querySelector('.w-dyn-empty') !== null;

    // If list is empty, hide it
    if (isEmpty && list instanceof HTMLElement) {
      list.style.display = 'none';
    }
  });
}
