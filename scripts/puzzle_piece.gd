class_name PuzzlePiece
extends Node2D

signal locked_in_place(piece)

var target_position: Vector2 = Vector2.ZERO
var snap_distance: float = 42.0
var piece_id: int = -1
var locked: bool = false

var _dragging: bool = false
var _drag_offset: Vector2 = Vector2.ZERO
var _active_touch: int = -1
var _area: Area2D
var _visual: Polygon2D
var _base_z_index: int = 10


func setup(
	texture: Texture2D,
	polygon_points: PackedVector2Array,
	uv_points: PackedVector2Array,
	target: Vector2,
	display_scale: float,
	id: int,
	snap_distance_px: float
) -> void:
	piece_id = id
	target_position = target
	snap_distance = snap_distance_px
	scale = Vector2.ONE * display_scale
	z_index = _base_z_index

	var shadow := Polygon2D.new()
	shadow.polygon = polygon_points
	shadow.color = Color(0.0, 0.0, 0.0, 0.28)
	shadow.position = Vector2(6.0, 7.0) / display_scale
	shadow.z_index = -1
	add_child(shadow)

	_visual = Polygon2D.new()
	_visual.polygon = polygon_points
	_visual.uv = uv_points
	_visual.texture = texture
	_visual.antialiased = true
	add_child(_visual)

	var outline := Line2D.new()
	outline.points = polygon_points
	outline.closed = true
	outline.width = 1.5 / display_scale
	outline.default_color = Color(1.0, 1.0, 1.0, 0.46)
	outline.antialiased = true
	outline.z_index = 1
	add_child(outline)

	_area = Area2D.new()
	_area.input_pickable = true
	_area.collision_layer = 1
	_area.collision_mask = 0
	add_child(_area)

	var collision := CollisionPolygon2D.new()
	collision.polygon = polygon_points
	_area.add_child(collision)
	_area.input_event.connect(_on_area_input_event)

	set_process_input(false)


func place_scrambled(at_position: Vector2) -> void:
	locked = false
	_dragging = false
	global_position = at_position
	z_index = _base_z_index
	if is_instance_valid(_area):
		_area.input_pickable = true
	if is_instance_valid(_visual):
		_visual.modulate = Color.WHITE
	set_process_input(false)


func _on_area_input_event(viewport, event: InputEvent, _shape_idx: int) -> void:
	if locked:
		return

	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			_start_drag(event.position, -1)
			viewport.set_input_as_handled()
	elif event is InputEventScreenTouch:
		if event.pressed:
			_start_drag(event.position, event.index)
			viewport.set_input_as_handled()


func _start_drag(pointer_position: Vector2, touch_index: int) -> void:
	_dragging = true
	_active_touch = touch_index
	_drag_offset = global_position - pointer_position
	z_index = 1000
	if is_instance_valid(_visual):
		_visual.modulate = Color(1.0, 1.0, 1.0, 1.0)
	set_process_input(true)


func _input(event: InputEvent) -> void:
	if not _dragging:
		return

	if _active_touch < 0:
		if event is InputEventMouseMotion:
			global_position = event.position + _drag_offset
		elif event is InputEventMouseButton:
			if event.button_index == MOUSE_BUTTON_LEFT and not event.pressed:
				_finish_drag()
	else:
		if event is InputEventScreenDrag and event.index == _active_touch:
			global_position = event.position + _drag_offset
		elif event is InputEventScreenTouch:
			if event.index == _active_touch and not event.pressed:
				_finish_drag()


func _finish_drag() -> void:
	_dragging = false
	_active_touch = -1
	set_process_input(false)

	if global_position.distance_to(target_position) <= snap_distance:
		global_position = target_position
		locked = true
		z_index = _base_z_index
		if is_instance_valid(_area):
			_area.input_pickable = false
		if is_instance_valid(_visual):
			_visual.modulate = Color.WHITE
		locked_in_place.emit(self)
	else:
		z_index = _base_z_index
		if is_instance_valid(_visual):
			_visual.modulate = Color.WHITE
