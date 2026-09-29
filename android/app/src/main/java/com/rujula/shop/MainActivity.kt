package com.rujula.shop
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
class MainActivity:ComponentActivity(){override fun onCreate(b:Bundle?){super.onCreate(b);setContent{RujulaApp()}}}
@Composable fun RujulaApp(vm:ShopVM=viewModel()){val ps by vm.products.collectAsState();MaterialTheme{Scaffold(topBar={TopAppBar(title={Text("RUJULA SHOP")})}){pad->Column(Modifier.padding(pad).padding(12.dp)){OutlinedTextField(vm.query,{vm.query=it;vm.load()},label={Text("Search products")},modifier=Modifier.fillMaxWidth());LazyColumn{items(ps){p->Card(Modifier.fillMaxWidth().padding(5.dp)){Column(Modifier.padding(15.dp)){Text(p.name,style=MaterialTheme.typography.titleMedium);Text(p.category);Text("₱%.2f".format(p.price));Text(p.description);Text("Stock: ${p.stock}")}}}}}}}}
class ShopVM:ViewModel(){var query by mutableStateOf("");private val state=mutableStateOf(listOf<Product>());val products:State<List<Product>> get()=state;init{load()};fun load(){viewModelScope.launch{try{state.value=ApiClient.service.products(query)}catch(_:Exception){}}}}
